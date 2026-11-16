import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { reportsApi } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import {
  agruparVentas, calcularCrecimiento, desdeParaGrafico, hoyLocal, mejorPeriodo,
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

const AYUDA: Record<Agrupacion, string> = {
  dia: "",
  semana: "",
  mes: "Últimos 12 meses",
  anio: "Últimos 3 años",
};

interface Props {
  /** Ventas diarias del rango elegido arriba en la pantalla. */
  dias: VentaDelDia[];
  /** Texto del rango elegido («2026-11-01 al 2026-11-16»). */
  rangoTexto: string;
  storeId?: string;
  /** Los mismos filtros del reporte, para que el gráfico no cuente otra cosa. */
  estados: string;
  incluirEnvio: boolean;
}

/**
 * Evolución de ventas por día, semana, mes o año, con la variación frente al periodo anterior para ver si se está creciendo.
 * Día y semana usan el rango de fechas elegido en la pantalla; mes y año piden por su cuenta los últimos 12 meses o 3 años,
 * con los mismos filtros, para poder comparar aunque el rango de arriba sea corto.
 */
export function EvolucionDeVentas({ dias, rangoTexto, storeId, estados, incluirEnvio }: Props) {
  const [modo, setModo] = useState<Agrupacion>("dia");
  const hoy = useMemo(() => hoyLocal(), []);
  const desde = desdeParaGrafico(modo, hoy);

  const { data: largo, isFetching: cargandoLargo } = useQuery({
    queryKey: ["sales-evolution", storeId, modo, desde, hoy, estados, incluirEnvio],
    queryFn: () => reportsApi.getSales(desde!, hoy, estados || undefined, incluirEnvio),
    enabled: !!storeId && desde !== null,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

  const base: VentaDelDia[] = desde !== null ? (largo?.data?.byDay ?? []) : dias;
  const puntos = useMemo(() => agruparVentas(base, modo, hoy), [base, modo, hoy]);
  const crecimiento = useMemo(() => calcularCrecimiento(base, puntos, modo), [base, puntos, modo]);
  const mejor = useMemo(() => mejorPeriodo(puntos), [puntos]);
  const total = puntos.reduce((s, p) => s + p.sales, 0);

  const sube = (crecimiento?.pct ?? 0) >= 0;
  const subtitulo = desde !== null ? `${AYUDA[modo]} · hasta hoy` : rangoTexto;

  const tooltip = (
    <Tooltip
      cursor={{ fill: "rgba(120,120,120,.12)" }}
      labelFormatter={(_, items) => (items?.[0]?.payload as any)?.titulo ?? ""}
      formatter={(v: number, name: string) => (name === "sales" ? [money(v), "Ventas"] : [v, "Pedidos"])}
      contentStyle={{ borderRadius: 12, border: "1px solid rgba(120,120,120,.25)", background: "rgba(20,20,20,.92)", color: "#fff", fontSize: 12 }}
      labelStyle={{ color: "#fff", fontWeight: 600 }}
    />
  );
  const ejes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} minTickGap={modo === "dia" ? 20 : 8} />
      <YAxis tickLine={false} axisLine={false} width={62} tick={{ fontSize: 11 }} tickFormatter={montoCorto} domain={[0, "auto"]} allowDecimals={false} />
    </>
  );

  return (
    <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h3 className="font-semibold">Evolución de ventas</h3>
          <p className="text-xs text-muted-foreground">{subtitulo}</p>
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 min-h-6 text-xs">
        {crecimiento ? (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", sube ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400")}>
            {sube ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {sube ? "+" : ""}{crecimiento.pct.toLocaleString("es-PE")} %
          </span>
        ) : (
          <span className="text-muted-foreground">Aún no hay con qué comparar en este rango.</span>
        )}
        {crecimiento && <span className="text-muted-foreground">{crecimiento.texto}</span>}
        {mejor && mejor.sales > 0 && <span className="text-muted-foreground">Mejor periodo: <span className="font-medium text-foreground">{mejor.titulo}</span> ({money(mejor.sales)})</span>}
        {puntos.length > 0 && <span className="text-muted-foreground">Total mostrado: <span className="font-medium text-foreground">{money(total)}</span></span>}
        {cargandoLargo && desde !== null && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

      {puntos.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          {cargandoLargo && desde !== null ? "Cargando…" : "Sin datos para mostrar en este rango."}
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {modo === "dia" ? (
              <AreaChart data={puntos} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FCCB34" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#FCCB34" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                {ejes}
                {tooltip}
                <Area type="monotone" dataKey="sales" stroke="#FCCB34" strokeWidth={2} fill="url(#salesFill)" />
              </AreaChart>
            ) : (
              <BarChart data={puntos} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                {ejes}
                {tooltip}
                <Bar dataKey="sales" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {puntos.map((p) => (
                    // El periodo que aún no termina se ve más claro: es parcial y no debe leerse como una caída.
                    <Cell key={p.clave} fill="#FCCB34" fillOpacity={p.enCurso ? 0.4 : 1} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {modo !== "dia" && puntos.some((p) => p.enCurso) && (
        <p className="text-[11px] text-muted-foreground mt-2">La barra más clara es el periodo en curso: todavía no terminó y no cuenta para el porcentaje.</p>
      )}
    </div>
  );
}
