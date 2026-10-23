import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStores } from "@/contexts/StoreContext";
import { dashboardApi, DashboardInsights, moneyIn, money, PlanDelCliente, Ganadora } from "@/lib/dashboard-api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { channelName } from "@/components/marketplaces/format";
import { AlertTriangle, CalendarClock, ClipboardCheck, ExternalLink, Flame, Percent, Truck } from "lucide-react";
import {
  Card,
  DesgloseIgv,
  etiquetaIgv,
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

export function PlanCard({ plan }: { plan: PlanDelCliente }) {
  const cobraCuota = plan.modelo === "fijo" || plan.modelo === "mixto";
  const cobraComision = plan.modelo === "comision" || plan.modelo === "mixto";
  const variacion =
    plan.ventasMesAnterior > 0 ? Math.round(((plan.ventasMes - plan.ventasMesAnterior) / plan.ventasMesAnterior) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Próximo cobro: la fecha y todo lo que se cobrará ese día */}
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" /> Próximo cobro
              </p>
              <p className="text-2xl md:text-3xl font-bold tracking-tight mt-1">
                {plan.proximoPago ? fechaCorta(plan.proximoPago) : "Sin fecha definida"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {plan.ciclo.conFechaPactada
                  ? `Incluye lo vendido del ${fechaCorta(plan.ciclo.desde)} al ${fechaCorta(plan.ciclo.hasta)}`
                  : "Mientras no haya fecha, se cuenta el mes en curso"}
              </p>
            </div>
            {plan.estadoPago && (
              <Badge className={cn("text-[10px] shrink-0", TONO_DE_PAGO[plan.estadoPago])}>
                {textoDePago(plan.estadoPago, plan.diasParaPago)}
              </Badge>
            )}
          </div>
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-1.5">Lo que llevas hasta esa fecha</p>
            <DesgloseIgv importe={plan.cobro} moneda={plan.moneda} porcentaje={plan.igvPorcentaje} />
          </div>
          {plan.ultimoPago && (
            <p className="text-xs text-muted-foreground mt-3">
              Último pago: {moneyIn(plan.ultimoPago.monto, plan.moneda)} · {fechaCorta(plan.ultimoPago.fecha)}
            </p>
          )}
        </Card>

        <div className="space-y-4">
          {cobraCuota && plan.cobro.cuota && (
            <Card>
              <p className="text-xs text-muted-foreground">Tu cuota fija</p>
              <p className="text-2xl font-bold tracking-tight mt-1">
                {moneyIn(plan.cobro.cuota.pactado, plan.moneda)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {NOMBRE_DE_FRECUENCIA[plan.frecuencia] ?? ""} · {etiquetaIgv(plan.cuotaIncluyeIgv)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {plan.cobro.cuota.incluyeIgv
                  ? `Incluye ${moneyIn(plan.cobro.cuota.igv, plan.moneda)} de IGV`
                  : `Más ${moneyIn(plan.cobro.cuota.igv, plan.moneda)} de IGV = ${moneyIn(plan.cobro.cuota.total, plan.moneda)}`}
              </p>
            </Card>
          )}

          {cobraComision && plan.cobro.comision && (
            <Card>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5" /> Tu facturación por comisión en este ciclo
              </p>
              <p className="text-2xl font-bold tracking-tight mt-1">
                {moneyIn(plan.cobro.comision.pactado, plan.moneda)}{" "}
                <span className="text-xs font-normal text-muted-foreground">{etiquetaIgv(plan.comisionIncluyeIgv)}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {plan.tasa}% sobre {moneyIn(plan.ventasCiclo, plan.moneda)} en productos vendidos
                {variacion !== null && (
                  <span className={cn("ml-1 font-medium", variacion >= 0 ? "text-green-500" : "text-destructive")}>
                    ({variacion >= 0 ? "+" : ""}
                    {variacion}% el mes vs el anterior)
                  </span>
                )}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">A la fecha de cobro, a este ritmo</p>
                  <p className="font-semibold">
                    {plan.comisionProyectada != null ? moneyIn(plan.comisionProyectada, plan.moneda) : "Desde el 3.er día del ciclo"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendido el mes pasado</p>
                  <p className="font-semibold">{plan.ventasMesAnterior > 0 ? moneyIn(plan.ventasMesAnterior, plan.moneda) : "—"}</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Se calcula solo sobre el precio de los productos que pagan tus clientes, sin costos de envío ni otros cargos. Crece con
                tus ventas: cuanto más vendes, más aumenta lo que se factura.
              </p>
            </Card>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Plan: {NOMBRE_DE_MODELO[plan.modelo]}.</p>
    </div>
  );
}

// ─── Productos ganadores ──────────────────────────────────────────────────────

function FilaGanadora({ g, posicion }: { g: Ganadora; posicion: number }) {
  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <span className="w-5 text-center text-xs font-semibold text-muted-foreground shrink-0">{posicion}</span>
        <div className="w-11 h-11 rounded-xl bg-secondary/40 overflow-hidden shrink-0">
          {g.imagen && <img src={g.imagen} alt="" className="w-full h-full object-cover" loading="lazy" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{g.nombre}</p>
          <p className="text-[11px] font-mono text-muted-foreground truncate" title="SKU">{g.sku}</p>
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
      {g.canal && (
        <div className="mt-2 ml-[3.75rem] flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
          <span title={(g.canales ?? []).map((c) => `${channelName(c.marketplace)}: ${c.unidades} u. · ${money(c.importe)} (${c.porcentaje} %)`).join("\n")}>
            Más vendido en <span className="font-medium text-foreground">{channelName(g.canal.marketplace)}</span>
            {(g.canales?.length ?? 0) > 1 ? ` · ${g.canal.porcentaje} %` : ""}
          </span>
          {g.canal.url && (
            <a
              href={g.canal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Ver publicación
            </a>
          )}
        </div>
      )}
    </div>
  );
}

type OrdenDeGanadoras = "importe" | "unidades";

/** Lista de ganadoras con orden a elegir: por ingresos (predeterminado) o por unidades vendidas. */
function Ganadoras({ lista }: { lista: Ganadora[] }) {
  const [orden, setOrden] = useState<OrdenDeGanadoras>("importe");
  const [verMas, setVerMas] = useState(false);
  const ordenadas = useMemo(
    () => [...lista].sort((a, b) => (orden === "importe" ? b.importe - a.importe || b.unidades - a.unidades : b.unidades - a.unidades || b.importe - a.importe)),
    [lista, orden],
  );
  const visibles = verMas ? ordenadas.slice(0, 10) : ordenadas.slice(0, 5);
  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-1" role="group" aria-label="Ordenar productos ganadores">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Ordenar por</span>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {([["importe", "Ingresos"], ["unidades", "Unidades"]] as const).map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setOrden(valor)}
              aria-pressed={orden === valor}
              className={cn("px-2.5 py-1 text-xs rounded-md transition-colors", orden === valor ? "bg-primary/15 text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y divide-border/50">
        {visibles.map((g, n) => (
          <FilaGanadora key={g.sku} g={g} posicion={n + 1} />
        ))}
      </div>
      {ordenadas.length > 5 && (
        <button type="button" onClick={() => setVerMas((v) => !v)} className="mt-1 w-full text-center text-xs text-muted-foreground hover:text-foreground py-1.5">
          {verMas ? "Ver solo los 5 primeros" : `Ver hasta ${Math.min(10, ordenadas.length)}`}
        </button>
      )}
    </>
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

// ─── Vista ────────────────────────────────────────────────────────────────────

/**
 * Lo que ayuda en el día a día a quien tiene una tienda: avisos, su plan,
 * productos ganadores y ventas recientes. Es solo la vista: la usan el
 * dashboard del cliente y la ficha que ve el superadmin de cada cliente.
 */
export function InsightsView({ i }: { i: DashboardInsights }) {
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
        titulo={`${i.pendientesDeRevision} ${i.pendientesDeRevision === 1 ? "cambio espera" : "cambios esperan"} aprobación`}
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
          <SectionTitle title="Plan y cobros" subtitle={`${NOMBRE_DE_MODELO[i.plan.modelo]} · lo que se paga y cuándo`} />
          <PlanCard plan={i.plan} />
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <section>
          <SectionTitle title="Productos ganadores" subtitle="Lo que más se vendió en los últimos 30 días" />
          <Card>
            {i.ganadoras.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Cuando haya ventas, aquí se verá qué productos mueven el negocio y cuándo reponerlos.
              </p>
            ) : (
              <Ganadoras lista={i.ganadoras} />
            )}
          </Card>
          {i.ganadoras.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
              <Flame className="w-3 h-3" /> Mantén a las ganadoras con stock y publicadas: son las que más dan.
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

// ─── Módulo ───────────────────────────────────────────────────────────────────

/** El panel del cliente: lo que le ayuda en el día a día. Va debajo de los números del negocio. */
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
  return <InsightsView i={data.data} />;
}
