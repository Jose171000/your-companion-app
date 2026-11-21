import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { reportsApi } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import {
  agruparVentas, compararConAnterior, fechaLarga, mejorPeriodo, periodoAnterior, sumaDeVentas, variacion,
  type Agrupacion, type VentaDelDia,
} from "@/lib/ventas-por-periodo";

const money = (n: number) =>
  `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Ejes con escala legible: 850, 2.5k, 12k. */
const montoCorto = (v: number) => {
  const n = Number(v) || 0;
  if (n >= 1_000_000) return `S/${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `S/${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `S/${Math.round(n)}`;
};

const OPCIONES: { id: Agrupacion; label: string }[] = [
  { id: "dia", label: "Día" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "anio", label: "Año" },
];

const UNIDAD: Record<Agrupacion, string> = { dia: "días", semana: "semanas", mes: "meses", anio: "años" };
const UNO: Record<Agrupacion, string> = { dia: "día", semana: "semana", mes: "mes", anio: "año" };

interface Props {
  /** Ventas diarias del rango elegido en la pantalla. */
  dias: VentaDelDia[];
  /** El rango elegido («Personalizado», últimos 30 días, un mes…), «AAAA-MM-DD». */
  from: string;
  to: string;
  storeId?: string;
  /** Los mismos filtros del reporte, para que el gráfico y la comparación no cuenten otra cosa. */
  estados: string;
  incluirEnvio: boolean;
  /** Canal elegido (vacío = todos) */
  canal?: string;
}

/**
 * Evolución de ventas dentro del rango elegido, agrupada por día, semana, mes o año, y comparada con el periodo anterior de la MISMA
 * duración (30 días → los 30 anteriores; un mes completo → el mes anterior) para ver si se está creciendo. La línea punteada es el
 * periodo anterior, alineado por posición.
 */
export function EvolucionDeVentas({ dias, from, to, storeId, estados, incluirEnvio, canal }: Props) {
  const [modo, setModo] = useState<Agrupacion>("dia");
  const anterior = useMemo(() => periodoAnterior(from, to), [from, to]);

  const { data: previo, isFetching: cargandoPrevio } = useQuery({
    queryKey: ["sales-previous", storeId, anterior?.from, anterior?.to, estados, incluirEnvio, canal ?? ""],
    queryFn: () => reportsApi.getSales(anterior!.from, anterior!.to, estados || undefined, incluirEnvio, canal || undefined),
    enabled: !!storeId && !!anterior,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  const diasPrevios: VentaDelDia[] = previo?.data?.byDay ?? [];
  const hayPrevio = !!previo?.data;

  const actual = useMemo(() => agruparVentas(dias, modo, from, to), [dias, modo, from, to]);
  const puntosPrevios = useMemo(() => (anterior && hayPrevio ? agruparVentas(diasPrevios, modo, anterior.from, anterior.to) : []), [diasPrevios, modo, anterior, hayPrevio]);
  const datos = useMemo(() => compararConAnterior(actual, puntosPrevios), [actual, puntosPrevios]);

  const totalActual = useMemo(() => sumaDeVentas(dias.filter((d) => d.date >= from && d.date <= to)), [dias, from, to]);
  const totalPrevio = useMemo(() => sumaDeVentas(diasPrevios), [diasPrevios]);
  const pct = hayPrevio ? variacion(totalActual.sales, totalPrevio.sales) : null;
  const sube = (pct ?? 0) >= 0;
  const mejor = useMemo(() => mejorPeriodo(actual), [actual]);

  return (
    <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h3 className="font-semibold">Evolución de ventas</h3>
          <p className="text-xs text-muted-foreground">{fechaLarga(from)} al {fechaLarga(to)} · agrupado por {UNIDAD[modo]}</p>
        </div>
        <div className="inline-flex rounded-lg bg-secondary/60 p-1" role="tablist" aria-label="Agrupar por">
          {OPCIONES.map((o) => (
            <button
              key={o.id}
              type="button"
              role="tab"
              aria-selected={modo === o.id}
              onClick={() => setModo(o.id)}
              className={cn(
                "px-3 py-1 text-xs rounded-md transition-colors",
                modo === o.id ? "bg-[#FCCB34] text-[#111] font-semibold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comparación con el periodo anterior de la misma duración */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 min-h-6 text-xs">
        {anterior && pct !== null && (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", sube ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400")}>
            {sube ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {sube ? "+" : ""}{pct.toLocaleString("es-PE")} %
          </span>
        )}
        {anterior && hayPrevio && (
          <span className="text-muted-foreground">
            vs {anterior.etiqueta} ({fechaLarga(anterior.from)} al {fechaLarga(anterior.to)}): <span className="font-medium text-foreground">{money(totalPrevio.sales)}</span>
            {pct === null && " · sin ventas en ese periodo, no hay base para comparar"}
          </span>
        )}
        {cargandoPrevio && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        {mejor && mejor.sales > 0 && <span className="text-muted-foreground">Mejor periodo: <span className="font-medium text-foreground">{mejor.titulo}</span> ({money(mejor.sales)})</span>}
      </div>

      {datos.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Sin datos para mostrar en este rango.</div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={datos} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FCCB34" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#FCCB34" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} minTickGap={modo === "dia" ? 20 : 8} />
              <YAxis tickLine={false} axisLine={false} width={62} tick={{ fontSize: 11 }} tickFormatter={montoCorto} domain={[0, "auto"]} allowDecimals={false} />
              <Tooltip
                labelFormatter={(_, items) => (items?.[0]?.payload as any)?.titulo ?? ""}
                formatter={(v: number, name: string, item: any) =>
                  name === "prevSales" ? [money(v), `${anterior?.etiqueta ?? "Anterior"}${item?.payload?.prevTitulo ? ` (${item.payload.prevTitulo})` : ""}`] : [money(v), "Ventas"]
                }
                contentStyle={{ borderRadius: 12, border: "1px solid rgba(120,120,120,.25)", background: "rgba(20,20,20,.92)", color: "#fff", fontSize: 12 }}
                labelStyle={{ color: "#fff", fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="sales" stroke="#FCCB34" strokeWidth={2} fill="url(#salesFill)" />
              {hayPrevio && <Line type="monotone" dataKey="prevSales" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {datos.length === 1 && modo !== "dia" && (
        <p className="text-[11px] text-muted-foreground mt-2">Con este rango solo hay 1 punto por {UNO[modo]}. Elige un rango más largo en «Personalizado» para ver la evolución.</p>
      )}
      {anterior && (
        <p className="text-[11px] text-muted-foreground mt-2">
          <span className="inline-block w-4 border-t-2 border-[#FCCB34] align-middle mr-1" /> Periodo elegido
          <span className="inline-block w-4 border-t-2 border-dashed border-[#9ca3af] align-middle mx-1 ml-4" /> {anterior.etiqueta}
        </p>
      )}
    </div>
  );
}
