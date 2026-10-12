import { useQuery } from "@tanstack/react-query";
import { useStores } from "@/contexts/StoreContext";
import { dashboardApi, moneyIn, money, PlanDelCliente, Ganadora } from "@/lib/dashboard-api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertTriangle, CalendarClock, ClipboardCheck, Flame, Percent, Truck } from "lucide-react";
import {
  Card,
  fechaCorta,
  NOMBRE_DE_FRECUENCIA,
  NOMBRE_DE_MODELO,
  SectionTitle,
  textoDePago,
  TONO_DE_PAGO,
} from "./DashboardParts";

// ─── Aviso del día ────────────────────────────────────────────────────────────

function Aviso({ icono, titulo, detalle, tono }: { icono: React.ReactNode; titulo: string; detalle: string; tono: "danger" | "warning" }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-3 md:p-4",
        tono === "danger" ? "bg-destructive/5 border-destructive/30" : "bg-amber-500/5 border-amber-500/30"
      )}
    >
      <div className={cn("mt-0.5 shrink-0", tono === "danger" ? "text-destructive" : "text-amber-500")}>{icono}</div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </div>
    </div>
  );
}

// ─── Plan: membresía y comisión ───────────────────────────────────────────────

function PlanCard({ plan }: { plan: PlanDelCliente }) {
  const cobraCuota = plan.modelo === "fijo" || plan.modelo === "mixto";
  const cobraComision = plan.modelo === "comision" || plan.modelo === "mixto";
  const variacion =
    plan.ventasMesAnterior > 0 ? Math.round(((plan.ventasMes - plan.ventasMesAnterior) / plan.ventasMesAnterior) * 100) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      {cobraCuota && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" /> Tu membresía
              </p>
              <p className="text-2xl md:text-3xl font-bold tracking-tight mt-1">
                {plan.proximoPago ? fechaCorta(plan.proximoPago) : "Sin fecha de pago"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Próximo pago</p>
            </div>
            {plan.estadoPago && (
              <Badge className={cn("text-[10px] shrink-0", TONO_DE_PAGO[plan.estadoPago])}>
                {textoDePago(plan.estadoPago, plan.diasParaPago)}
              </Badge>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Tu cuota</p>
              <p className="font-semibold">
                {plan.cuotaFija != null ? moneyIn(plan.cuotaFija, plan.moneda) : "—"}{" "}
                <span className="text-xs font-normal text-muted-foreground">{NOMBRE_DE_FRECUENCIA[plan.frecuencia] ?? ""}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Último pago</p>
              <p className="font-semibold">
                {plan.ultimoPago ? `${moneyIn(plan.ultimoPago.monto, plan.moneda)} · ${fechaCorta(plan.ultimoPago.fecha)}` : "—"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {cobraComision && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5" /> Tu facturación con nosotros este mes
              </p>
              <p className="text-2xl md:text-3xl font-bold tracking-tight mt-1">{moneyIn(plan.comisionAcumulada, plan.moneda)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {plan.tasa}% sobre {moneyIn(plan.ventasMes, plan.moneda)} vendidos
                {variacion !== null && (
                  <span className={cn("ml-1 font-medium", variacion >= 0 ? "text-green-500" : "text-destructive")}>
                    ({variacion >= 0 ? "+" : ""}
                    {variacion}% vs el mes pasado)
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Proyección a fin de mes</p>
              <p className="font-semibold">
                {plan.comisionProyectada != null ? moneyIn(plan.comisionProyectada, plan.moneda) : "Disponible desde el día 3"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mes pasado</p>
              <p className="font-semibold">
                {plan.liquidacionMesAnterior ? (
                  <>
                    {moneyIn(plan.liquidacionMesAnterior.comision, plan.moneda)}{" "}
                    <span className="text-xs font-normal text-muted-foreground capitalize">· {plan.liquidacionMesAnterior.estado}</span>
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Crece con tus ventas: cuanto más vendes, más aumenta lo que se factura este mes.
          </p>
        </Card>
      )}

      {plan.modelo === "mixto" && (
        <p className="text-xs text-muted-foreground lg:col-span-2 -mt-2">
          Plan: {NOMBRE_DE_MODELO[plan.modelo]} · Este mes llevas {moneyIn(plan.totalDelMes, plan.moneda)} entre cuota y comisión.
        </p>
      )}
    </div>
  );
}

// ─── Productos ganadores ──────────────────────────────────────────────────────

function FilaGanadora({ g, posicion }: { g: Ganadora; posicion: number }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="w-5 text-center text-xs font-semibold text-muted-foreground shrink-0">{posicion}</span>
      <div className="w-11 h-11 rounded-xl bg-secondary/40 overflow-hidden shrink-0">
        {g.imagen && <img src={g.imagen} alt="" className="w-full h-full object-cover" loading="lazy" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{g.nombre}</p>
        <p className="text-xs text-muted-foreground">
          {g.unidades} {g.unidades === 1 ? "unidad" : "unidades"} · {money(g.importe)}
        </p>
      </div>
      <div className="text-right shrink-0">
        {g.reponer ? (
          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]">
            {g.stock === 0 ? "Sin stock" : `Repón: ${g.stock} u.`}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{g.stock != null ? `${g.stock} u. en stock` : ""}</span>
        )}
        {g.diasDeStock != null && (
          <p className="text-[10px] text-muted-foreground mt-0.5">Stock para ~{g.diasDeStock} {g.diasDeStock === 1 ? "día" : "días"}</p>
        )}
      </div>
    </div>
  );
}

// ─── Ventas recientes ─────────────────────────────────────────────────────────

function VentasRecientes({ dias }: { dias: { dia: string; pedidos: number; importe: number }[] }) {
  const maximo = Math.max(...dias.map((d) => d.importe), 1);
  const total = dias.reduce((s, d) => s + d.importe, 0);
  const pedidos = dias.reduce((s, d) => s + d.pedidos, 0);
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="text-2xl font-bold tracking-tight">{money(total)}</p>
        <p className="text-xs text-muted-foreground">
          {pedidos} {pedidos === 1 ? "pedido" : "pedidos"} en 14 días
        </p>
      </div>
      <div className="flex items-end gap-1 h-24" role="img" aria-label="Ventas de los últimos 14 días">
        {dias.map((d) => (
          <div key={d.dia} className="flex-1 flex flex-col justify-end h-full" title={`${fechaCorta(d.dia)}: ${money(d.importe)} · ${d.pedidos} ped.`}>
            <div
              className={cn("w-full rounded-t-sm", d.importe > 0 ? "bg-primary" : "bg-secondary/60")}
              style={{ height: `${d.importe > 0 ? Math.max(8, (d.importe / maximo) * 100) : 4}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
        <span>{fechaCorta(dias[0]?.dia)}</span>
        <span>Hoy</span>
      </div>
    </Card>
  );
}

// ─── Módulo ───────────────────────────────────────────────────────────────────

/** Lo que ayuda en el día a día a quien tiene una tienda. Va debajo de los números del negocio. */
export function ClientInsights() {
  const { activeStore } = useStores();
  const storeId = activeStore?.id;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-insights", storeId],
    enabled: !!storeId,
    queryFn: () => dashboardApi.getInsights(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }
  if (isError || !data?.data) return null;

  const i = data.data;
  const avisos = [];
  if (i.porDespachar.total > 0) {
    avisos.push(
      <Aviso
        key="despacho"
        tono={i.porDespachar.vencidos > 0 ? "danger" : "warning"}
        icono={<Truck className="w-4 h-4" />}
        titulo={`${i.porDespachar.total} ${i.porDespachar.total === 1 ? "venta por despachar" : "ventas por despachar"}`}
        detalle={
          i.porDespachar.vencidos > 0
            ? `${i.porDespachar.vencidos} ya pasó su fecha límite y ${i.porDespachar.hoy} vence hoy. Mira la pestaña Ventas de Marketplaces.`
            : "Vencen hoy. Mira la pestaña Ventas de Marketplaces."
        }
      />
    );
  }
  if (i.pendientesDeRevision > 0) {
    avisos.push(
      <Aviso
        key="revision"
        tono="warning"
        icono={<ClipboardCheck className="w-4 h-4" />}
        titulo={`${i.pendientesDeRevision} ${i.pendientesDeRevision === 1 ? "cambio espera" : "cambios esperan"} tu aprobación`}
        detalle="Cambios de precio o stock en la pestaña Revisión de Marketplaces."
      />
    );
  }
  const reponer = i.ganadoras.filter((g) => g.reponer);
  if (reponer.length > 0) {
    avisos.push(
      <Aviso
        key="reponer"
        tono="warning"
        icono={<AlertTriangle className="w-4 h-4" />}
        titulo={`${reponer.length === 1 ? "Un producto ganador se está acabando" : `${reponer.length} productos ganadores se están acabando`}`}
        detalle={`${reponer.map((g) => g.nombre).slice(0, 2).join(" y ")}${reponer.length > 2 ? "…" : ""}: repón antes de que dejen de publicarse.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      {avisos.length > 0 && <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{avisos}</div>}

      {i.plan && (
        <section>
          <SectionTitle title="Tu plan" subtitle={`${NOMBRE_DE_MODELO[i.plan.modelo]} · lo que pagas y cuándo`} />
          <PlanCard plan={i.plan} />
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <section>
          <SectionTitle title="Tus productos ganadores" subtitle="Lo que más se vendió en los últimos 30 días" />
          <Card>
            {i.ganadoras.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Cuando tengas ventas, aquí verás qué productos mueven tu negocio y cuándo reponerlos.
              </p>
            ) : (
              <div className="divide-y divide-border/50 -my-3">
                {i.ganadoras.map((g, n) => (
                  <FilaGanadora key={g.sku} g={g} posicion={n + 1} />
                ))}
              </div>
            )}
          </Card>
          {i.ganadoras.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
              <Flame className="w-3 h-3" /> Mantén a las ganadoras con stock y publicadas: son las que más te dan.
            </p>
          )}
        </section>

        <section>
          <SectionTitle title="Ventas recientes" subtitle="Día por día, últimos 14 días" />
          <VentasRecientes dias={i.ventasDiarias} />
        </section>
      </div>
    </div>
  );
}
