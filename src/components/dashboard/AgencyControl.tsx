import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { dashboardApi, AgencyClient, moneyIn } from "@/lib/dashboard-api";
import { adminApi } from "@/lib/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AlertTriangle, BadgeDollarSign, CalendarClock, Copy, HandCoins, Percent, TrendingUp, Wallet } from "lucide-react";
import {
  Card,
  fechaCorta,
  Kpi,
  LoadingGrid,
  NOMBRE_DE_FRECUENCIA,
  NOMBRE_DE_MODELO,
  SectionTitle,
  textoDePago,
  TONO_DE_PAGO,
} from "./DashboardParts";

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

// ─── Ficha del cliente: resumen, propuesta y plan ─────────────────────────────

function FichaDelCliente({ cliente, onClose }: { cliente: AgencyClient | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [modelo, setModelo] = useState("ninguno");
  const [cuota, setCuota] = useState("");
  const [frecuencia, setFrecuencia] = useState("mensual");
  const [tasa, setTasa] = useState("");
  const [proximoPago, setProximoPago] = useState("");
  const [notas, setNotas] = useState("");

  // Al abrir otro cliente, el formulario parte de su plan actual.
  useEffect(() => {
    if (!cliente) return;
    setModelo(cliente.plan.modelo);
    setCuota(cliente.plan.cuotaFija != null ? String(cliente.plan.cuotaFija) : "");
    setFrecuencia(cliente.plan.frecuencia || "mensual");
    setTasa(cliente.plan.tasa != null ? String(cliente.plan.tasa) : "");
    setProximoPago(cliente.plan.proximoPago ?? "");
    setNotas(cliente.notasDePropuesta ?? "");
  }, [cliente]);

  const guardar = useMutation({
    mutationFn: () => {
      const cobraCuota = modelo === "fijo" || modelo === "mixto";
      const cobraComision = modelo === "comision" || modelo === "mixto";
      return adminApi.updateProfile(cliente!.id, {
        billingModel: modelo as any,
        monthlyFee: cobraCuota && cuota !== "" ? Number(cuota) : null,
        feeFrequency: frecuencia as any,
        commissionRate: cobraComision && tasa !== "" ? Number(tasa) : null,
        nextDueDate: cobraCuota && proximoPago ? proximoPago : null,
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
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  if (!cliente) return null;
  const { plan, propuesta } = cliente;
  const cobraCuota = modelo === "fijo" || modelo === "mixto";
  const cobraComision = modelo === "comision" || modelo === "mixto";

  const copiar = () =>
    navigator.clipboard.writeText(propuesta.texto).then(
      () => toast.success("Propuesta copiada"),
      () => toast.error("No se pudo copiar; selecciónala y cópiala a mano")
    );

  return (
    <Dialog open={!!cliente} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cliente.empresa || cliente.nombre}</DialogTitle>
          <DialogDescription>{cliente.email}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="resumen">
          <TabsList>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="propuesta">Propuesta</TabsTrigger>
            <TabsTrigger value="plan">Plan y cobro</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground">Ventas este mes</p>
                <p className="text-xl font-bold">{moneyIn(cliente.ventas.mes, plan.moneda)}</p>
                <p className="text-[11px] text-muted-foreground">{cliente.ventas.pedidosMes} pedidos</p>
              </div>
              <div className="rounded-xl bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground">A cobrar este mes</p>
                <p className="text-xl font-bold">{moneyIn(plan.totalDelMes, plan.moneda)}</p>
                <p className="text-[11px] text-muted-foreground">{NOMBRE_DE_MODELO[plan.modelo]}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Ventas de los meses anteriores</p>
              <div className="divide-y divide-border/50 rounded-xl border border-border">
                {cliente.ventas.mesesAnteriores.map((m) => (
                  <div key={m.periodo} className="flex justify-between px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{m.periodo}</span>
                    <span className="font-medium">{moneyIn(m.importe, plan.moneda)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Próximo pago</p>
                <p className="font-medium">
                  {plan.proximoPago ? fechaCorta(plan.proximoPago) : "—"}
                  {plan.estadoPago && (
                    <Badge className={cn("ml-2 text-[10px]", TONO_DE_PAGO[plan.estadoPago])}>
                      {textoDePago(plan.estadoPago, plan.diasParaPago)}
                    </Badge>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Último pago</p>
                <p className="font-medium">
                  {cliente.ultimoPago ? `${moneyIn(cliente.ultimoPago.monto, plan.moneda)} · ${fechaCorta(cliente.ultimoPago.fecha)}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Liquidación del mes pasado</p>
                <p className="font-medium">
                  {cliente.liquidacionMesAnterior
                    ? `${moneyIn(cliente.liquidacionMesAnterior.comision, plan.moneda)} · ${cliente.liquidacionMesAnterior.estado}`
                    : "—"}
                </p>
              </div>
              {plan.comisionProyectada != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Comisión proyectada a fin de mes</p>
                  <p className="font-medium">{moneyIn(plan.comisionProyectada, plan.moneda)}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="propuesta" className="pt-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{propuesta.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  Ventas promedio: {moneyIn(propuesta.ventasPromedio, plan.moneda)} al mes
                  {propuesta.tendencia === "sube" && " · en alza"}
                  {propuesta.tendencia === "baja" && " · a la baja"}
                </p>
              </div>
              <Badge className={cn("text-[10px] shrink-0", TONO_RECOMENDACION[propuesta.recomendacion])}>
                {NOMBRE_RECOMENDACION[propuesta.recomendacion]}
              </Badge>
            </div>

            {propuesta.escenarios.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {propuesta.escenarios.map((e) => (
                  <div key={e.modelo} className="rounded-xl bg-secondary/30 p-3">
                    <p className="text-xs text-muted-foreground">{e.etiqueta}</p>
                    <p className="text-lg font-bold">{moneyIn(e.costoMensual, plan.moneda)}</p>
                    <p className="text-[11px] text-muted-foreground">al mes</p>
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
                Se calcula con lo que vende y con el plan pactado. Es una referencia: ajústala antes de enviarla.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas-propuesta">Tus apuntes para este cliente</Label>
              <Textarea id="notas-propuesta" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Lo hablado con el cliente, condiciones, fechas de revisión…" />
              <Button size="sm" onClick={() => guardar.mutate()} disabled={guardar.isPending}>
                Guardar apuntes
              </Button>
            </div>
          </TabsContent>

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

            {cobraCuota && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="plan-cuota">Cuota ({plan.moneda})</Label>
                  <Input id="plan-cuota" type="number" min="0" step="0.01" value={cuota} onChange={(e) => setCuota(e.target.value)} placeholder="300" />
                </div>
                <div className="space-y-2">
                  <Label>Se paga</Label>
                  <Select value={frecuencia} onValueChange={setFrecuencia}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensual">Cada mes</SelectItem>
                      <SelectItem value="trimestral">Cada trimestre</SelectItem>
                      <SelectItem value="anual">Cada año</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="plan-vence">Próximo pago</Label>
                  <Input id="plan-vence" type="date" value={proximoPago} onChange={(e) => setProximoPago(e.target.value)} />
                  <p className="text-[11px] text-muted-foreground">
                    Al registrar un pago recurrente en la ficha del cliente, esta fecha avanza sola un periodo.
                  </p>
                </div>
              </div>
            )}

            {cobraComision && (
              <div className="space-y-2">
                <Label htmlFor="plan-tasa">Comisión sobre sus ventas (%)</Label>
                <Input id="plan-tasa" type="number" min="0" max="100" step="0.1" value={tasa} onChange={(e) => setTasa(e.target.value)} placeholder="5" />
                <p className="text-[11px] text-muted-foreground">
                  Se aplica sobre el precio de los productos que pagó el comprador. No incluye costos de envío ni otros cargos.
                </p>
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
            c.plan.cuotaFija != null ? `${moneyIn(c.plan.cuotaFija, c.plan.moneda)} ${NOMBRE_DE_FRECUENCIA[c.plan.frecuencia] ?? ""}` : null,
            c.plan.tasa != null ? `${c.plan.tasa}%` : null,
          ].filter(Boolean).join(" + ") || "—"}
        </p>
      </div>

      <div className="col-span-6 md:col-span-2">
        {c.plan.proximoPago ? (
          <>
            <p className="font-medium">{fechaCorta(c.plan.proximoPago)}</p>
            {c.plan.estadoPago && (
              <Badge className={cn("text-[10px] mt-1", TONO_DE_PAGO[c.plan.estadoPago])}>{textoDePago(c.plan.estadoPago, c.plan.diasParaPago)}</Badge>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
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

      <div className="col-span-4 md:col-span-2">
        <p className="font-medium">{moneyIn(c.plan.totalDelMes, c.plan.moneda)}</p>
        <p className="text-xs text-muted-foreground">a cobrar este mes</p>
      </div>

      <div className="col-span-4 md:col-span-1 text-right">
        <Badge className={cn("text-[10px]", TONO_RECOMENDACION[c.propuesta.recomendacion])}>{NOMBRE_RECOMENDACION[c.propuesta.recomendacion]}</Badge>
      </div>
    </button>
  );
}

// ─── Módulo ───────────────────────────────────────────────────────────────────

/** Control de la cartera para superadmins: cuánto vende cada cliente, qué hay que cobrarle y qué proponerle. */
export function AgencyControl() {
  const [abierto, setAbierto] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-agency"],
    queryFn: () => dashboardApi.getAgency(),
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingGrid count={6} />;
  if (isError || !data?.data) return null;

  const a = data.data;
  const t = a.totales;
  const seleccionado = a.clientes.find((c) => c.id === abierto) ?? null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <Kpi
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
          label="Ventas de tus clientes este mes (solo productos)"
          value={moneyIn(t.ventasDelMes)}
          hint={`${t.pedidosDelMes} pedidos · de tus clientes: ${moneyIn(t.ventasDeClientes)}`}
        />
        <Kpi
          icon={<BadgeDollarSign className="w-5 h-5 text-primary" />}
          label="Ingreso fijo mensual"
          value={moneyIn(t.ingresoFijoMensual)}
          hint={`${t.porModelo.fijo + t.porModelo.mixto} clientes con cuota`}
        />
        <Kpi
          icon={<Percent className="w-5 h-5 text-primary" />}
          label="Comisión acumulada del mes"
          value={moneyIn(t.comisionAcumulada)}
          hint={`Proyectada a fin de mes: ${moneyIn(t.comisionProyectada)}`}
        />
        <Kpi
          icon={<Wallet className="w-5 h-5 text-green-500" />}
          label="Cobrado este mes"
          value={moneyIn(t.cobradoEsteMes)}
          tone="success"
        />
        <Kpi
          icon={<AlertTriangle className={cn("w-5 h-5", t.vencidos.cantidad ? "text-destructive" : "text-primary")} />}
          label="Cobros vencidos"
          value={moneyIn(t.vencidos.monto)}
          hint={t.vencidos.cantidad ? `${t.vencidos.cantidad} ${t.vencidos.cantidad === 1 ? "cliente" : "clientes"}` : "Nadie atrasado"}
          tone={t.vencidos.cantidad ? "danger" : "default"}
        />
        <Kpi
          icon={<CalendarClock className="w-5 h-5 text-amber-500" />}
          label="Por cobrar en 7 días"
          value={moneyIn(t.proximos.monto)}
          hint={t.proximos.cantidad ? `${t.proximos.cantidad} ${t.proximos.cantidad === 1 ? "cliente" : "clientes"}` : "Nada próximo"}
          tone={t.proximos.cantidad ? "warning" : "default"}
        />
      </div>

      {t.sinPlan > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <HandCoins className="w-3.5 h-3.5" />
          {t.sinPlan} {t.sinPlan === 1 ? "cliente no tiene" : "clientes no tienen"} un plan definido: ábrelos para fijar su cuota o comisión.
        </p>
      )}

      <section>
        <SectionTitle title="Cartera de clientes" subtitle="Primero quienes tienen un cobro vencido o próximo. Toca un cliente para ver su propuesta y su plan." />
        <Card className="p-2 md:p-3">
          {a.clientes.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Todavía no hay clientes registrados.</p>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-12 gap-2 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="col-span-3">Cliente</span>
                <span className="col-span-2">Plan</span>
                <span className="col-span-2">Próximo pago</span>
                <span className="col-span-2">Ventas del mes</span>
                <span className="col-span-2">A cobrar</span>
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

      <FichaDelCliente cliente={seleccionado} onClose={() => setAbierto(null)} />
    </div>
  );
}
