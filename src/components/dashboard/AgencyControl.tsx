import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { dashboardApi, AgencyClient, moneyIn, OrigenDeTienda } from "@/lib/dashboard-api";
import { adminApi } from "@/lib/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AlertTriangle, BadgeDollarSign, CalendarClock, Coins, Copy, HandCoins, Percent, Store as StoreIcon, TrendingUp, Wallet } from "lucide-react";
import {
  Card,
  desglosarIgv,
  DesgloseIgv,
  etiquetaIgv,
  fechaCorta,
  Kpi,
  LoadingGrid,
  NOMBRE_DE_FRECUENCIA,
  NOMBRE_DE_MODELO,
  SectionTitle,
  textoDePago,
  TONO_DE_PAGO,
} from "./DashboardParts";
import { NegocioView } from "./NegocioView";
import { InsightsView } from "./ClientInsights";

const TONO_RECOMENDACION: Record<string, string> = {
  pasar_a_comision: "bg-green-500/10 text-green-500 border-green-500/30",
  pasar_a_fijo: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  definir_plan: "bg-primary/10 text-primary border-primary/30",
  mantener: "bg-secondary text-muted-foreground border-border",
  sin_datos: "bg-secondary text-muted-foreground border-border",
};

const NOMBRE_RECOMENDACION: Record<string, string> = {
  pasar_a_comision: "Proponer comisión",
  pasar_a_fijo: "Revisar cuota",
  definir_plan: "Definir plan",
  mantener: "Mantener",
  sin_datos: "Sin datos",
};

// ─── Detalle: el dashboard del cliente, tal como lo ve él ─────────────────────

function DetalleDelCliente({ clienteId }: { clienteId: string }) {
  const [tiendaId, setTiendaId] = useState<string | undefined>(undefined);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-client-detail", clienteId, tiendaId],
    queryFn: () => dashboardApi.getClientDetail(clienteId, tiendaId),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }
  if (isError || !data?.data) {
    return <p className="text-sm text-muted-foreground">No se pudo cargar el detalle de este cliente. Reintenta en unos segundos.</p>;
  }

  const d = data.data;
  if (!d.resumen || !d.insights) {
    return <p className="text-sm text-muted-foreground">Este cliente todavía no tiene una tienda creada.</p>;
  }

  return (
    <div className="space-y-5">
      {d.tiendas.length > 1 && (
        <div className="flex items-center gap-2">
          <Label className="shrink-0">Tienda</Label>
          <Select value={d.tiendaId ?? undefined} onValueChange={setTiendaId}>
            <SelectTrigger className="h-9 max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {d.tiendas.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <NegocioView s={d.resumen} />
      <InsightsView i={d.insights} />
    </div>
  );
}

// ─── Tiendas: a qué cliente pertenece cada una ─────────────────────────────────

const NOMBRE_DE_ORIGEN: Record<OrigenDeTienda, string> = {
  asignada: "Asignada a mano",
  dueno: "Es suya",
  nombre: "Por el nombre del negocio",
};

/** Asigna una tienda a un cliente y refresca todo lo que depende de ello. */
function useAsignarTienda() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { tiendaId: string; clienteId: string | null }) => dashboardApi.assignStore(v.tiendaId, v.clienteId),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tienda actualizada");
      queryClient.invalidateQueries({ queryKey: ["dashboard-agency"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-store-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-client-detail"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-accounts"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });
}

/** Tiendas con ventas o canales que no son de ningún cliente: aquí se les pone dueño. */
function TiendasSinAsignar({ tiendas, clientes }: { tiendas: { id: string; nombre: string; dueno: string; ventasMes: number; pedidosMes: number; canales: number }[]; clientes: AgencyClient[] }) {
  const asignar = useAsignarTienda();
  if (!tiendas.length) return null;
  return (
    <section>
      <SectionTitle
        title="Tiendas sin cliente asignado"
        subtitle="Sus ventas se cuentan en el total, pero no en la cartera de ningún cliente. Asígnalas a quien corresponda."
      />
      <Card className="p-2 md:p-3 border-amber-500/30">
        <div className="divide-y divide-border/50">
          {tiendas.map((t) => (
            <div key={t.id} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm flex items-center gap-1.5"><StoreIcon className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{t.nombre}</span></p>
                <p className="text-xs text-muted-foreground truncate">
                  A nombre de {t.dueno} · {t.canales} {t.canales === 1 ? "canal" : "canales"} · {moneyIn(t.ventasMes)} este mes ({t.pedidosMes} ped.)
                </p>
              </div>
              <Select onValueChange={(clienteId) => asignar.mutate({ tiendaId: t.id, clienteId })} disabled={asignar.isPending}>
                <SelectTrigger className="h-9 md:w-64"><SelectValue placeholder="Asignar a un cliente…" /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.empresa || c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

/** Las tiendas de un cliente, y cuáles más se le pueden asignar. */
function TiendasDelCliente({ cliente }: { cliente: AgencyClient }) {
  const asignar = useAsignarTienda();
  const { data } = useQuery({
    queryKey: ["dashboard-store-assignments"],
    queryFn: () => dashboardApi.getStoreAssignments(),
    staleTime: 30_000,
  });
  const todas = data?.data ?? [];
  const disponibles = todas.filter((t) => t.clienteId !== cliente.id);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Las ventas, los canales y la comisión del cliente salen de estas tiendas. No importa a nombre de quién estén creadas ni quién conectó las cuentas.
      </p>

      <div className="rounded-xl border border-border divide-y divide-border/50">
        {cliente.tiendas.length === 0 ? (
          <p className="text-sm text-muted-foreground p-3">Este cliente todavía no tiene ninguna tienda. Agrégale una abajo.</p>
        ) : (
          cliente.tiendas.map((t) => {
            const info = todas.find((x) => x.id === t.id);
            return (
              <div key={t.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.origen ? NOMBRE_DE_ORIGEN[t.origen] : ""}
                    {info && ` · ${info.canales} ${info.canales === 1 ? "canal" : "canales"} · ${moneyIn(info.ventasMes)} este mes`}
                  </p>
                </div>
                {t.origen === "asignada" && (
                  <Button variant="outline" size="sm" disabled={asignar.isPending} onClick={() => asignar.mutate({ tiendaId: t.id, clienteId: null })}>
                    Quitar
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-2">
        <Label>Agregar una tienda a este cliente</Label>
        <Select onValueChange={(tiendaId) => asignar.mutate({ tiendaId, clienteId: cliente.id })} disabled={asignar.isPending || disponibles.length === 0}>
          <SelectTrigger><SelectValue placeholder={disponibles.length ? "Elige una tienda…" : "No hay más tiendas"} /></SelectTrigger>
          <SelectContent>
            {disponibles.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nombre} · {t.dueno}
                {t.clienteId ? " (hoy de otro cliente)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── Ficha del cliente: cobro, detalle, propuesta y plan ──────────────────────

/** Selector «el IGV va aparte / ya lo incluye» con el ejemplo calculado debajo. */
function SelectorDeIgv({
  id,
  incluye,
  onChange,
  ejemplo,
}: {
  id: string;
  incluye: boolean;
  onChange: (incluye: boolean) => void;
  ejemplo: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>IGV</Label>
      <Select value={incluye ? "incluido" : "aparte"} onValueChange={(v) => onChange(v === "incluido")}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="aparte">El IGV va aparte (se suma)</SelectItem>
          <SelectItem value="incluido">El monto ya incluye IGV</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">{ejemplo}</p>
    </div>
  );
}

function FichaDelCliente({ cliente, igv, onClose }: { cliente: AgencyClient | null; igv: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("resumen");
  const [modelo, setModelo] = useState("ninguno");
  const [cuota, setCuota] = useState("");
  const [cuotaConIgv, setCuotaConIgv] = useState(false);
  const [frecuencia, setFrecuencia] = useState("mensual");
  const [tasa, setTasa] = useState("");
  const [comisionConIgv, setComisionConIgv] = useState(false);
  const [proximoPago, setProximoPago] = useState("");
  const [vigenteDesde, setVigenteDesde] = useState("");
  const [notas, setNotas] = useState("");

  // Al abrir otro cliente, la ficha parte de su resumen y el formulario de su plan actual.
  useEffect(() => {
    if (!cliente) return;
    setTab("resumen");
    setModelo(cliente.plan.modelo);
    setCuota(cliente.plan.cuotaFija != null ? String(cliente.plan.cuotaFija) : "");
    setCuotaConIgv(cliente.plan.cuotaIncluyeIgv);
    setFrecuencia(cliente.plan.frecuencia || "mensual");
    setTasa(cliente.plan.tasa != null ? String(cliente.plan.tasa) : "");
    setComisionConIgv(cliente.plan.comisionIncluyeIgv);
    setProximoPago(cliente.plan.proximoPago ?? "");
    setVigenteDesde("");
    setNotas(cliente.notasDePropuesta ?? "");
  }, [cliente]);

  const guardar = useMutation({
    mutationFn: () => {
      const conPlan = modelo !== "ninguno";
      const cobraCuota = modelo === "fijo" || modelo === "mixto";
      const cobraComision = modelo === "comision" || modelo === "mixto";
      return adminApi.updateProfile(cliente!.id, {
        billingModel: modelo as any,
        monthlyFee: cobraCuota && cuota !== "" ? Number(cuota) : null,
        feeIncludesIgv: cuotaConIgv,
        feeFrequency: frecuencia as any,
        commissionRate: cobraComision && tasa !== "" ? Number(tasa) : null,
        commissionIncludesIgv: comisionConIgv,
        nextDueDate: conPlan && proximoPago ? proximoPago : null,
        ...(vigenteDesde ? { planStartDate: vigenteDesde } : {}),
        proposalNotes: notas.trim() || null,
      });
    },
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Plan guardado");
      queryClient.invalidateQueries({ queryKey: ["dashboard-agency"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-client-detail"] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  if (!cliente) return null;
  const { plan, propuesta } = cliente;
  const conPlan = modelo !== "ninguno";
  const cobraCuota = modelo === "fijo" || modelo === "mixto";
  const cobraComision = modelo === "comision" || modelo === "mixto";
  const moneda = plan.moneda;

  const copiar = () =>
    navigator.clipboard.writeText(propuesta.texto).then(
      () => toast.success("Propuesta copiada"),
      () => toast.error("No se pudo copiar; selecciónala y cópiala a mano")
    );

  const ejemploCuota = (() => {
    const d = desglosarIgv(Number(cuota) || 0, cuotaConIgv, igv);
    return `${cuotaConIgv ? "Con IGV incluido" : "Con IGV aparte"}: ${moneyIn(d.subtotal, moneda)} + ${moneyIn(d.igv, moneda)} de IGV = ${moneyIn(d.total, moneda)}`;
  })();
  const ejemploComision = (() => {
    const base = ((Number(tasa) || 0) * 1000) / 100;
    const d = desglosarIgv(base, comisionConIgv, igv);
    return `Por cada ${moneyIn(1000, moneda)} vendidos: comisión ${moneyIn(d.subtotal, moneda)} + ${moneyIn(d.igv, moneda)} de IGV = ${moneyIn(d.total, moneda)}`;
  })();

  return (
    <Dialog open={!!cliente} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cliente.empresa || cliente.nombre}</DialogTitle>
          <DialogDescription>{cliente.email}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="resumen">Cobro</TabsTrigger>
            <TabsTrigger value="detalle">Detalle del negocio</TabsTrigger>
            <TabsTrigger value="tiendas">Tiendas ({cliente.tiendas.length})</TabsTrigger>
            <TabsTrigger value="propuesta">Propuesta</TabsTrigger>
            <TabsTrigger value="plan">Plan y cobro</TabsTrigger>
          </TabsList>

          {/* ── Cobro ── */}
          <TabsContent value="resumen" className="pt-4 space-y-4">
            {plan.modelo === "ninguno" ? (
              <p className="text-sm text-muted-foreground">
                Este cliente no tiene un plan definido. Fíjalo en la pestaña «Plan y cobro» para ver qué cobrarle y cuándo.
              </p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5" /> Próximo cobro
                    </p>
                    <p className="text-2xl font-bold tracking-tight">{plan.proximoPago ? fechaCorta(plan.proximoPago) : "Sin fecha definida"}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan.ciclo.conFechaPactada
                        ? `Ventas contadas del ${fechaCorta(plan.ciclo.desde)} al ${fechaCorta(plan.ciclo.hasta)}`
                        : "Sin fecha: se cuenta el mes en curso. Define el próximo cobro en «Plan y cobro»."}
                    </p>
                  </div>
                  {plan.estadoPago && (
                    <Badge className={cn("text-[10px] shrink-0", TONO_DE_PAGO[plan.estadoPago])}>{textoDePago(plan.estadoPago, plan.diasParaPago)}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    {plan.cobro.cuota && (
                      <div className="rounded-xl bg-secondary/30 p-3 text-sm">
                        <p className="text-xs text-muted-foreground">Cuota fija ({NOMBRE_DE_FRECUENCIA[plan.frecuencia] ?? ""})</p>
                        <p className="font-semibold">
                          {moneyIn(plan.cobro.cuota.pactado, moneda)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">{etiquetaIgv(plan.cuotaIncluyeIgv)}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {moneyIn(plan.cobro.cuota.subtotal, moneda)} + {moneyIn(plan.cobro.cuota.igv, moneda)} IGV = {moneyIn(plan.cobro.cuota.total, moneda)}
                        </p>
                      </div>
                    )}
                    {plan.cobro.comision && (
                      <div className="rounded-xl bg-secondary/30 p-3 text-sm">
                        <p className="text-xs text-muted-foreground">
                          Comisión {plan.tasa}% sobre {moneyIn(plan.ventasCiclo, moneda)} en productos
                        </p>
                        <p className="font-semibold">
                          {moneyIn(plan.cobro.comision.pactado, moneda)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">{etiquetaIgv(plan.comisionIncluyeIgv)}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {moneyIn(plan.cobro.comision.subtotal, moneda)} + {moneyIn(plan.cobro.comision.igv, moneda)} IGV = {moneyIn(plan.cobro.comision.total, moneda)}
                          {plan.comisionProyectada != null && ` · a su fecha de cobro, a este ritmo: ${moneyIn(plan.comisionProyectada, moneda)}`}
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Total a cobrar en esa fecha</p>
                    <DesgloseIgv importe={plan.cobro} moneda={moneda} porcentaje={plan.igvPorcentaje} />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground">Ventas este mes (solo productos)</p>
                <p className="text-xl font-bold">{moneyIn(cliente.ventas.mes, moneda)}</p>
                <p className="text-[11px] text-muted-foreground">{cliente.ventas.pedidosMes} pedidos</p>
              </div>
              <div className="rounded-xl bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground">Último pago</p>
                <p className="text-xl font-bold">{cliente.ultimoPago ? moneyIn(cliente.ultimoPago.monto, moneda) : "—"}</p>
                <p className="text-[11px] text-muted-foreground">{cliente.ultimoPago ? fechaCorta(cliente.ultimoPago.fecha) : "Sin pagos registrados"}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Ventas de los meses anteriores</p>
              <div className="divide-y divide-border/50 rounded-xl border border-border">
                {cliente.ventas.mesesAnteriores.map((m) => (
                  <div key={m.periodo} className="flex justify-between px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{m.periodo}</span>
                    <span className="font-medium">{moneyIn(m.importe, moneda)}</span>
                  </div>
                ))}
              </div>
              {cliente.liquidacionMesAnterior && (
                <p className="text-xs text-muted-foreground mt-2">
                  Liquidación {cliente.liquidacionMesAnterior.periodo}: {moneyIn(cliente.liquidacionMesAnterior.comision, moneda)} · {cliente.liquidacionMesAnterior.estado}
                </p>
              )}
            </div>
          </TabsContent>

          {/* ── Detalle del negocio (se carga al abrirla) ── */}
          <TabsContent value="detalle" className="pt-4">
            {tab === "detalle" && <DetalleDelCliente clienteId={cliente.id} />}
          </TabsContent>

          {/* ── Tiendas del cliente ── */}
          <TabsContent value="tiendas" className="pt-4">
            <TiendasDelCliente cliente={cliente} />
          </TabsContent>

          {/* ── Propuesta ── */}
          <TabsContent value="propuesta" className="pt-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{propuesta.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  Ventas promedio en productos: {moneyIn(propuesta.ventasPromedio, moneda)} al mes
                  {propuesta.tendencia === "sube" && " · en alza"}
                  {propuesta.tendencia === "baja" && " · a la baja"}
                </p>
              </div>
              <Badge className={cn("text-[10px] shrink-0", TONO_RECOMENDACION[propuesta.recomendacion])}>{NOMBRE_RECOMENDACION[propuesta.recomendacion]}</Badge>
            </div>

            {propuesta.escenarios.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {propuesta.escenarios.map((e) => (
                  <div key={e.modelo} className="rounded-xl bg-secondary/30 p-3">
                    <p className="text-xs text-muted-foreground">{e.etiqueta}</p>
                    <p className="text-lg font-bold">{moneyIn(e.costoMensual, moneda)}</p>
                    <p className="text-[11px] text-muted-foreground">al mes, sin IGV</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Borrador para el cliente</Label>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copiar}>
                  <Copy className="w-3.5 h-3.5" /> Copiar
                </Button>
              </div>
              <p className="text-sm rounded-xl bg-secondary/30 p-3 leading-relaxed whitespace-pre-wrap">{propuesta.texto}</p>
              <p className="text-[11px] text-muted-foreground">
                Se calcula con lo que vende y con el plan pactado, siempre sobre el precio de los productos y sin IGV. Es una referencia: ajústala antes de enviarla.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas-propuesta">Tus apuntes para este cliente</Label>
              <Textarea id="notas-propuesta" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Lo hablado con el cliente, condiciones, fechas de revisión…" />
              <Button size="sm" onClick={() => guardar.mutate()} disabled={guardar.isPending}>Guardar apuntes</Button>
            </div>
          </TabsContent>

          {/* ── Plan y cobro ── */}
          <TabsContent value="plan" className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label>Cómo se le cobra</Label>
              <Select value={modelo} onValueChange={setModelo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">Sin plan definido</SelectItem>
                  <SelectItem value="fijo">Cuota fija</SelectItem>
                  <SelectItem value="comision">Comisión sobre ventas</SelectItem>
                  <SelectItem value="mixto">Cuota fija + comisión</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {conPlan && (
              <div className="rounded-xl border border-border p-3 space-y-3">
                <p className="text-sm font-medium flex items-center gap-1.5"><CalendarClock className="w-4 h-4" /> Cuándo se cobra</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-vence">Próxima fecha de cobro</Label>
                    <Input id="plan-vence" type="date" value={proximoPago} onChange={(e) => setProximoPago(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Se cobra</Label>
                    <Select value={frecuencia} onValueChange={setFrecuencia}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensual">Cada mes</SelectItem>
                        <SelectItem value="trimestral">Cada trimestre</SelectItem>
                        <SelectItem value="anual">Cada año</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="plan-desde">Plan vigente desde (opcional)</Label>
                    <Input id="plan-desde" type="date" value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Las ventas se cuentan desde un periodo antes de esa fecha (o desde que rige el plan, si fue después) hasta el día anterior al cobro. Al registrar un pago recurrente del cliente, la fecha avanza sola.
                </p>
              </div>
            )}

            {cobraCuota && (
              <div className="rounded-xl border border-border p-3 space-y-3">
                <p className="text-sm font-medium flex items-center gap-1.5"><Coins className="w-4 h-4" /> Cuota fija</p>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-cuota">Monto de la cuota ({moneda})</Label>
                  <Input id="plan-cuota" type="number" min="0" step="0.01" value={cuota} onChange={(e) => setCuota(e.target.value)} placeholder="1000" />
                </div>
                <SelectorDeIgv id="igv-cuota" incluye={cuotaConIgv} onChange={setCuotaConIgv} ejemplo={ejemploCuota} />
              </div>
            )}

            {cobraComision && (
              <div className="rounded-xl border border-border p-3 space-y-3">
                <p className="text-sm font-medium flex items-center gap-1.5"><Percent className="w-4 h-4" /> Comisión sobre ventas</p>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-tasa">Porcentaje sobre sus ventas (%)</Label>
                  <Input id="plan-tasa" type="number" min="0" max="100" step="0.1" value={tasa} onChange={(e) => setTasa(e.target.value)} placeholder="5" />
                  <p className="text-[11px] text-muted-foreground">
                    Se aplica sobre el precio de los productos que pagó el comprador. No incluye costos de envío ni otros cargos.
                  </p>
                </div>
                <SelectorDeIgv id="igv-comision" incluye={comisionConIgv} onChange={setComisionConIgv} ejemplo={ejemploComision} />
              </div>
            )}

            <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
              {guardar.isPending ? "Guardando…" : "Guardar plan"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Fila de cliente ──────────────────────────────────────────────────────────

function FilaCliente({ c, onOpen }: { c: AgencyClient; onOpen: () => void }) {
  const anterior = c.ventas.mesesAnteriores[0]?.importe ?? 0;
  const variacion = anterior > 0 ? Math.round(((c.ventas.mes - anterior) / anterior) * 100) : null;
  const conPlan = c.plan.modelo !== "ninguno";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-xl text-sm text-left hover:bg-secondary/30 transition-colors",
        c.plan.estadoPago === "vencido" && "bg-destructive/5"
      )}
    >
      <div className="col-span-12 md:col-span-3 min-w-0">
        <p className="font-medium truncate">{c.empresa || c.nombre}</p>
        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
      </div>

      <div className="col-span-6 md:col-span-2">
        <Badge variant="outline" className="text-[10px]">{NOMBRE_DE_MODELO[c.plan.modelo]}</Badge>
        <p className="text-xs text-muted-foreground mt-1">
          {[
            c.plan.cuotaFija != null ? `${moneyIn(c.plan.cuotaFija, c.plan.moneda)} ${etiquetaIgv(c.plan.cuotaIncluyeIgv)}` : null,
            c.plan.tasa != null ? `${c.plan.tasa}% ${etiquetaIgv(c.plan.comisionIncluyeIgv)}` : null,
          ].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>

      <div className="col-span-6 md:col-span-2">
        {conPlan && c.plan.proximoPago ? (
          <>
            <p className="font-medium">{fechaCorta(c.plan.proximoPago)}</p>
            {c.plan.estadoPago && (
              <Badge className={cn("text-[10px] mt-1", TONO_DE_PAGO[c.plan.estadoPago])}>{textoDePago(c.plan.estadoPago, c.plan.diasParaPago)}</Badge>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{conPlan ? "Sin fecha de cobro" : "—"}</span>
        )}
      </div>

      <div className="col-span-4 md:col-span-2">
        <p className="font-medium">{moneyIn(c.ventas.mes, c.plan.moneda)}</p>
        <p className="text-xs text-muted-foreground">
          {c.ventas.pedidosMes} ped.
          {variacion !== null && (
            <span className={cn("ml-1", variacion >= 0 ? "text-green-500" : "text-destructive")}>
              {variacion >= 0 ? "+" : ""}{variacion}%
            </span>
          )}
        </p>
      </div>

      <div className="col-span-5 md:col-span-2">
        {conPlan ? (
          <>
            <p className="font-medium">{moneyIn(c.plan.cobro.total, c.plan.moneda)}</p>
            <p className="text-[11px] text-muted-foreground">IGV incl. {moneyIn(c.plan.cobro.igv, c.plan.moneda)}</p>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      <div className="col-span-3 md:col-span-1 text-right">
        <Badge className={cn("text-[10px]", TONO_RECOMENDACION[c.propuesta.recomendacion])}>{NOMBRE_RECOMENDACION[c.propuesta.recomendacion]}</Badge>
      </div>
    </button>
  );
}

// ─── Módulo ───────────────────────────────────────────────────────────────────

/** Control de la cartera para superadmins: cuánto vende cada cliente, qué hay que cobrarle y cuándo. */
export function AgencyControl() {
  const [abierto, setAbierto] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-agency"],
    queryFn: () => dashboardApi.getAgency(),
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingGrid count={8} />;
  if (isError || !data?.data) return null;

  const a = data.data;
  const t = a.totales;
  const seleccionado = a.clientes.find((c) => c.id === abierto) ?? null;
  const detalleIgv = (x: { subtotal: number; igv: number }) => `Sin IGV ${moneyIn(x.subtotal)} · IGV ${moneyIn(x.igv)}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi
          icon={<HandCoins className="w-5 h-5 text-primary" />}
          label="Por ingresar hasta su fecha de cobro"
          value={moneyIn(t.porIngresar.total)}
          hint={`IGV incluido · ${detalleIgv(t.porIngresar)}`}
        />
        <Kpi
          icon={<BadgeDollarSign className="w-5 h-5 text-primary" />}
          label="En cuotas fijas"
          value={moneyIn(t.porIngresarCuotas.total)}
          hint={`IGV incluido · ${detalleIgv(t.porIngresarCuotas)}`}
        />
        <Kpi
          icon={<Percent className="w-5 h-5 text-primary" />}
          label="En comisiones acumuladas"
          value={moneyIn(t.porIngresarComisiones.total)}
          hint={`IGV incluido · ${detalleIgv(t.porIngresarComisiones)}`}
        />
        <Kpi icon={<Wallet className="w-5 h-5 text-green-500" />} label="Cobrado este mes" value={moneyIn(t.cobradoEsteMes)} tone="success" />
        <Kpi
          icon={<AlertTriangle className={cn("w-5 h-5", t.vencidos.cantidad ? "text-destructive" : "text-primary")} />}
          label="Cobros vencidos"
          value={moneyIn(t.vencidos.total)}
          hint={t.vencidos.cantidad ? `${t.vencidos.cantidad} ${t.vencidos.cantidad === 1 ? "cliente" : "clientes"} · IGV incl.` : "Nadie atrasado"}
          tone={t.vencidos.cantidad ? "danger" : "default"}
        />
        <Kpi
          icon={<CalendarClock className="w-5 h-5 text-amber-500" />}
          label="Por cobrar en 7 días"
          value={moneyIn(t.proximos.total)}
          hint={t.proximos.cantidad ? `${t.proximos.cantidad} ${t.proximos.cantidad === 1 ? "cliente" : "clientes"} · IGV incl.` : "Nada próximo"}
          tone={t.proximos.cantidad ? "warning" : "default"}
        />
        <Kpi
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
          label="Ventas de todas las tiendas este mes"
          value={moneyIn(t.ventasDelMes)}
          hint={`Solo productos · ${t.pedidosDelMes} pedidos · de tus clientes: ${moneyIn(t.ventasDeClientes)}`}
        />
        <Kpi
          icon={<Coins className="w-5 h-5 text-primary" />}
          label="Ingreso fijo mensual"
          value={moneyIn(t.ingresoFijoMensual)}
          hint={`Sin IGV · ${t.porModelo.fijo + t.porModelo.mixto} clientes con cuota`}
        />
      </div>

      {t.sinPlan > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <HandCoins className="w-3.5 h-3.5" />
          {t.sinPlan} {t.sinPlan === 1 ? "cliente no tiene" : "clientes no tienen"} un plan definido: ábrelos para fijar su cuota o comisión y su fecha de cobro.
        </p>
      )}

      <TiendasSinAsignar tiendas={a.sinAsignar} clientes={a.clientes} />

      <section>
        <SectionTitle
          title="Cartera de clientes"
          subtitle="Primero quienes tienen un cobro vencido o próximo. Toca un cliente para ver su cobro, el detalle de su negocio, su propuesta y su plan."
        />
        <Card className="p-2 md:p-3">
          {a.clientes.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Todavía no hay clientes registrados.</p>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-12 gap-2 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="col-span-3">Cliente</span>
                <span className="col-span-2">Plan</span>
                <span className="col-span-2">Fecha de cobro</span>
                <span className="col-span-2">Ventas del mes</span>
                <span className="col-span-2">Por cobrar (con IGV)</span>
                <span className="col-span-1 text-right">Propuesta</span>
              </div>
              <div className="space-y-1">
                {a.clientes.map((c) => (
                  <FilaCliente key={c.id} c={c} onOpen={() => setAbierto(c.id)} />
                ))}
              </div>
            </>
          )}
        </Card>
      </section>

      <FichaDelCliente cliente={seleccionado} igv={a.igvPorcentaje} onClose={() => setAbierto(null)} />
    </div>
  );
}
