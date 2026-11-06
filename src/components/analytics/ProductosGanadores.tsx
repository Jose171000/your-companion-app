import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Clock, Trophy } from "lucide-react";
import { reportsApi, type EstadoDeStock, type OrdenDeGanadores, type ProductoGanador } from "@/lib/admin-api";
import { ProductThumb } from "@/components/marketplaces/ProductThumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  storeId?: string;
  from?: string;
  to?: string;
  /** Estados de venta elegidos en el filtro de Analíticas (separados por coma); vacío = ventas concretadas */
  status?: string;
  /** El orden elegido se comparte con la descarga del reporte */
  orden: OrdenDeGanadores;
  onOrdenChange: (o: OrdenDeGanadores) => void;
}

const money = (n: number) => `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const entero = (n: number) => Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 0 });

const ORDENES: { id: OrdenDeGanadores; label: string }[] = [
  { id: "units", label: "Unidades" },
  { id: "revenue", label: "Ingresos" },
  { id: "days", label: "Se agota antes" },
];

const ESTILO: Record<EstadoDeStock, string> = {
  agotado: "bg-red-500/15 text-red-400 border-red-500/40",
  critico: "bg-red-500/10 text-red-400 border-red-500/30",
  pronto: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  suficiente: "bg-green-500/10 text-green-500 border-green-500/30",
  sin_ventas: "bg-secondary text-muted-foreground border-border",
};

const diasTexto = (g: ProductoGanador) => {
  const e = g.estimate;
  if (e.estado === "agotado") return "Agotado";
  if (e.estado === "sin_ventas" || e.dias == null) return "Sin ventas";
  if (e.dias < 1) return "Menos de 1 día";
  const d = Math.round(e.dias);
  return `${d} ${d === 1 ? "día" : "días"}`;
};

const fechaCorta = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-PE", { day: "numeric", month: "short" });

/** Urgencia para el orden «Se agota antes»: los agotados primero, los que no se venden al final. */
const urgencia = (g: ProductoGanador) => (g.estimate.estado === "agotado" ? -1 : g.estimate.dias ?? Number.POSITIVE_INFINITY);

function Fila({ g, puesto }: { g: ProductoGanador; puesto: number }) {
  const e = g.estimate;
  const detalle = e.estado === "agotado" || e.estado === "sin_ventas"
    ? null
    : `Al ritmo de ${e.porDia.toLocaleString("es-PE", { maximumFractionDigits: 1 })} u. por día${e.agotaEl ? `, hacia el ${fechaCorta(e.agotaEl)}` : ""}`;
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] lg:grid-cols-[28px_minmax(0,2.4fr)_70px_110px_64px_112px_minmax(0,1.4fr)] gap-x-3 gap-y-2 items-center py-3 border-t border-border/60 text-sm">
      <span className="text-xs text-muted-foreground tabular-nums text-center">{puesto}</span>
      <div className="min-w-0 flex items-center gap-3">
        <ProductThumb src={g.imageUrl} alt={g.name} className="w-11 h-11" />
        <div className="min-w-0">
          <p className="font-medium leading-snug line-clamp-2" title={g.name}>{g.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {[g.variant, g.sku].filter(Boolean).join(" · ") || "Sin SKU"}
          </p>
        </div>
      </div>

      {/* En pantallas chicas las cifras van debajo del nombre */}
      <div className="col-start-2 lg:col-start-auto grid grid-cols-3 gap-2 lg:contents">
        <div className="lg:text-right">
          <p className="text-[10px] uppercase text-muted-foreground lg:hidden">Unidades</p>
          <p className="font-semibold tabular-nums">{entero(g.units)}</p>
        </div>
        <div className="lg:text-right">
          <p className="text-[10px] uppercase text-muted-foreground lg:hidden">Ingresos</p>
          <p className="font-semibold tabular-nums">{money(g.revenue)}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">{g.share}% del total</p>
        </div>
        <div className="lg:text-right">
          <p className="text-[10px] uppercase text-muted-foreground lg:hidden">Stock</p>
          <p className="tabular-nums">{g.stock == null ? "—" : entero(g.stock)}</p>
        </div>
      </div>

      <div className="col-start-2 lg:col-start-auto">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={cn("text-[11px] gap-1 font-medium", ESTILO[e.estado])}>
                {(e.estado === "critico" || e.estado === "pronto") && <Clock className="w-3 h-3" />}
                {diasTexto(g)}
              </Badge>
            </TooltipTrigger>
            {detalle && <TooltipContent className="text-xs">{detalle}</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="col-start-2 lg:col-start-auto min-w-0">
        <p className={cn("text-xs font-medium", e.estado === "agotado" || e.estado === "critico" ? "text-red-400" : e.estado === "pronto" ? "text-yellow-400" : "text-muted-foreground")}>
          {e.recomendacion}
        </p>
        {e.sugerido > 0 && <p className="text-[11px] text-muted-foreground">Reponer ~{entero(e.sugerido)} u. para 30 días</p>}
      </div>
    </div>
  );
}

/** Lo que más se vende, cuánto dinero representa y cuánto tardaría en agotarse el stock según el historial de ventas. */
export function ProductosGanadores({ storeId, from, to, status, orden, onOrdenChange }: Props) {
  const [verTodos, setVerTodos] = useState(false);
  const { data: res, isLoading, isError } = useQuery({
    queryKey: ["top-products", storeId, from, to, status ?? ""],
    queryFn: () => reportsApi.getTopProducts(from, to, status || undefined),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });
  const informe = res?.data;

  // El servidor manda todos; aquí se ordenan, así cambiar el orden es instantáneo.
  const lista = useMemo(() => {
    const items = [...(informe?.items ?? [])];
    items.sort((a, b) =>
      orden === "revenue" ? b.revenue - a.revenue || b.units - a.units
        : orden === "days" ? urgencia(a) - urgencia(b) || b.units - a.units
          : b.units - a.units || b.revenue - a.revenue);
    return items;
  }, [informe, orden]);
  const visibles = verTodos ? lista : lista.slice(0, 10);
  const porReponer = lista.filter((g) => g.estimate.estado === "agotado" || g.estimate.estado === "critico").length;

  return (
    <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Trophy className="w-4 h-4 text-[#FCCB34]" /> Productos ganadores</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Lo más vendido del periodo y cuánto tardaría en agotarse su stock, según lo que vendió en los últimos {informe?.paceWindowDays ?? 30} días.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-secondary/40 p-1 w-fit" role="group" aria-label="Ordenar productos">
          {ORDENES.map((o) => (
            <Button
              key={o.id}
              size="sm"
              variant={orden === o.id ? "default" : "ghost"}
              className={cn("h-7 px-3 text-xs", orden === o.id && "bg-[#FCCB34] text-black hover:bg-[#FCCB34]/90")}
              onClick={() => onOrdenChange(o.id)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : isError || !informe ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No se pudieron cargar los productos. Vuelve a intentarlo en unos segundos.</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No hubo ventas de productos en este periodo.</p>
      ) : (
        <>
          {porReponer > 0 && (
            <p className="text-xs rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 mb-3">
              {porReponer} {porReponer === 1 ? "producto está agotado o se agota" : "productos están agotados o se agotan"} en menos de una semana. Revisa su stock.
            </p>
          )}
          <div className="hidden lg:grid grid-cols-[28px_minmax(0,2.4fr)_70px_110px_64px_112px_minmax(0,1.4fr)] gap-x-3 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="text-center">#</span>
            <span>Producto</span>
            <span className="text-right">Unidades</span>
            <span className="text-right">Ingresos</span>
            <span className="text-right">Stock</span>
            <span>Se agota en</span>
            <span>Recomendación</span>
          </div>
          {visibles.map((g, i) => <Fila key={g.productId ?? g.sku ?? `${g.name}-${i}`} g={g} puesto={i + 1} />)}
          {lista.length > 10 && (
            <div className="pt-3 border-t border-border/60">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setVerTodos((v) => !v)}>
                {verTodos ? "Ver solo los 10 primeros" : `Ver los ${lista.length} productos`}
              </Button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            El stock es el que tiene Synkro; cada canal puede tener otro número. Si un producto empezó a venderse hace poco, el ritmo se mide sobre los días que lleva vendiéndose.
          </p>
        </>
      )}
    </div>
  );
}
