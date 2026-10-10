import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useStores } from "@/contexts/StoreContext";
import { syncApi } from "@/lib/sync-api";
import { reportsApi } from "@/lib/admin-api";
import { EmbeddedReport } from "./EmbeddedReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2, Package, Receipt, RefreshCw, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const RANGES = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "90 días", days: 90 },
];

const money = (n: number) =>
  `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dayLabel = (d: string) => {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
};

const CHANNEL_NAMES: Record<string, string> = {
  mercadolibre: "MercadoLibre",
  shopify: "Shopify",
  amazon: "Amazon",
  woocommerce: "WooCommerce",
  falabella: "Falabella",
  ripley: "Ripley",
  juntoz: "Juntoz",
  tiendanube: "Tiendanube",
  vtex: "VTEX",
  sheets: "Otros canales",
};

/** Canales que llegan desde la hoja de cálculo pueden traer cualquier nombre */
const channelLabel = (id: string) =>
  CHANNEL_NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#FCCB34]/15 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[#FCCB34]" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl md:text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

/** "hace 5 min", "hace 3 h", o la fecha si fue hace más de dos días */
function haceCuanto(iso: string | null | undefined): string {
  if (!iso) return "todavía no ha entrado ninguna";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  if (min < 48 * 60) return `hace ${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString("es-PE");
}

export function AnalyticsModule() {
  const [days, setDays] = useState(30);
  const queryClient = useQueryClient();
  // Las analíticas son de la tienda activa: cada tienda tiene sus propias métricas.
  const { activeStore } = useStores();
  const storeId = activeStore?.id;
  const isOwner = activeStore?.role === "owner";

  const syncOrders = useMutation({
    mutationFn: () => syncApi.syncOrders(),
    onSuccess: (res) => {
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudieron actualizar las ventas");
        return;
      }
      const { cuentas, totalNuevos } = res.data;
      const fallidas = cuentas.filter((c) => c.error);
      if (!cuentas.length) toast.info("Esta tienda no tiene cuentas de ventas conectadas todavía.");
      else if (fallidas.length)
        toast.error(`${fallidas[0].nombre}: ${fallidas[0].error}`);
      else toast.success(totalNuevos ? `${totalNuevos} venta(s) nueva(s) registradas` : "Las ventas ya estaban al día");
      queryClient.invalidateQueries({ queryKey: ["sales-report"] });
      queryClient.invalidateQueries({ queryKey: ["sync-orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  // Reporte externo (AppScript/Looker) que el admin haya configurado
  const { data: configRes } = useQuery({
    queryKey: ["report-config", storeId],
    queryFn: () => reportsApi.getConfig(),
    enabled: !!storeId,
    staleTime: 5 * 60_000,
  });
  const embedUrl = configRes?.data?.embedUrl ?? null;
  const embedTitle = configRes?.data?.embedTitle || "Reporte detallado";

  const from = new Date(Date.now() - (days - 1) * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  const { data: result, isLoading, isError } = useQuery({
    queryKey: ["sales-report", storeId, from, to],
    queryFn: () => reportsApi.getSales(from, to),
    enabled: !!storeId,
    staleTime: 60_000,
    // Las ventas entran solas cada pocos minutos: se refresca sin recargar la página.
    refetchInterval: 2 * 60_000,
  });

  const report = result?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="glass rounded-2xl flex flex-col items-center justify-center py-16 text-center">
        <TrendingUp className="w-12 h-12 text-muted-foreground mb-4 opacity-40" />
        <p className="font-semibold text-muted-foreground">No se pudo cargar tu reporte</p>
        <p className="text-xs text-muted-foreground mt-1">Vuelve a intentarlo en unos segundos.</p>
      </div>
    );
  }

  const chartData = report.byDay.map((d) => ({ ...d, label: dayLabel(d.date) }));
  const hasData = report.totals.orders > 0 || report.totals.sales > 0;

  const nativeReport = (
    <div className="space-y-6">
      {/* Tienda activa y estado de la sincronización de ventas */}
      <div className="glass rounded-2xl border border-border dark:border-white/10 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="font-semibold text-sm">{activeStore?.name ?? "Tu tienda"}</p>
          <p className="text-xs text-muted-foreground">
            Última venta registrada: {haceCuanto(report.lastOrderAt)}. Las ventas se traen solas cada pocos minutos.
          </p>
        </div>
        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            disabled={syncOrders.isPending}
            onClick={() => syncOrders.mutate()}
          >
            {syncOrders.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Actualizar ventas ahora
          </Button>
        )}
      </div>

      {/* Selector de rango */}
      <div className="flex items-center gap-2">
        {RANGES.map((r) => (
          <Button
            key={r.days}
            variant={days === r.days ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(r.days)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={TrendingUp} label="Ventas del periodo" value={money(report.totals.sales)} />
        <KpiCard icon={Package} label="Pedidos" value={`${report.totals.orders}`} />
        <KpiCard icon={Receipt} label="Ticket promedio" value={money(report.totals.avgTicket)} />
      </div>

      {!hasData && (
        <div className="glass rounded-2xl border border-border dark:border-white/10 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#FCCB34] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm mb-1">Aún no hay ventas en este periodo</p>
            <p className="text-sm text-muted-foreground">
              Tus ventas aparecerán aquí automáticamente en cuanto se registren en los marketplaces
              conectados. Si tu operación reporta ventas en una hoja de cálculo, tu ejecutivo de cuenta puede
              vincularla para que también se sumen a este reporte.
            </p>
          </div>
        </div>
      )}

      {/* Evolución de ventas */}
      <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
        <h3 className="font-semibold mb-1">Evolución de ventas</h3>
        <p className="text-xs text-muted-foreground mb-6">
          {report.range.from} al {report.range.to}
        </p>

        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            Sin datos para mostrar en este rango.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FCCB34" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#FCCB34" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} minTickGap={20} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `S/${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : v}`}
                />
                <Tooltip
                  formatter={(v: number, name: string) =>
                    name === "sales" ? [money(v), "Ventas"] : [v, "Pedidos"]
                  }
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid rgba(120,120,120,.25)",
                    background: "rgba(20,20,20,.92)",
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="sales" stroke="#FCCB34" strokeWidth={2} fill="url(#salesFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Ventas por canal */}
      <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
        <h3 className="font-semibold mb-1">Ventas por canal</h3>
        <p className="text-xs text-muted-foreground mb-6">Comparativo del periodo seleccionado</p>

        {report.byChannel.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
            Sin ventas registradas por canal.
          </div>
        ) : (
          <>
            <div className="h-56 w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.byChannel.map((c) => ({
                    ...c,
                    name: channelLabel(c.channel),
                  }))}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={60}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `S/${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : v}`}
                  />
                  <Tooltip
                    formatter={(v: number) => [money(v), "Ventas"]}
                    cursor={{ fill: "rgba(252,203,52,.08)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(120,120,120,.25)",
                      background: "rgba(20,20,20,.92)",
                      color: "#fff",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="sales" fill="#FCCB34" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {report.byChannel.map((c) => (
                <div
                  key={c.channel}
                  className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">
                      {channelLabel(c.channel)}
                    </span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {c.source === "sheets" ? "hoja de cálculo" : "sincronizado"}
                    </Badge>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-sm tabular-nums">{money(c.sales)}</p>
                    <p className="text-[11px] text-muted-foreground">{c.orders} pedidos</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Por cuenta: solo cuando hay más de una */}
      {(report.byAccount?.length ?? 0) > 1 && (
        <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
          <h3 className="font-semibold mb-1">Ventas por cuenta</h3>
          <p className="text-xs text-muted-foreground mb-4">Cada cuenta de marketplace conectada a la tienda</p>
          <div className="space-y-2">
            {report.byAccount!.map((a) => (
              <div key={`${a.connectionId}-${a.channel}`} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{a.label || "Cuenta sin nombre"}</p>
                  <p className="text-[11px] text-muted-foreground">{channelLabel(a.channel)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm tabular-nums">{money(a.sales)}</p>
                  <p className="text-[11px] text-muted-foreground">{a.orders} pedidos</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Origen de los datos */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Fuentes:</span>
        <Badge variant="secondary" className={cn("text-[10px]", !report.sources.marketplaces && "opacity-50")}>
          Marketplaces {report.sources.marketplaces ? "✓" : "—"}
        </Badge>
        <Badge variant="secondary" className={cn("text-[10px]", !report.sources.sheets && "opacity-50")}>
          Hoja de cálculo {report.sources.sheets ? "✓" : "—"}
        </Badge>
        {report.sources.sheetError && (
          <span className="text-red-500">{report.sources.sheetError}</span>
        )}
      </div>
    </div>
  );

  // Sin reporte externo, se muestra solo el nativo
  if (!embedUrl) return nativeReport;

  return (
    <Tabs defaultValue="externo" className="space-y-4">
      <TabsList>
        <TabsTrigger value="externo">{embedTitle}</TabsTrigger>
        <TabsTrigger value="plataforma">Ventas en la plataforma</TabsTrigger>
      </TabsList>

      <TabsContent value="externo">
        <EmbeddedReport url={embedUrl} title={embedTitle} />
      </TabsContent>

      <TabsContent value="plataforma">{nativeReport}</TabsContent>
    </Tabs>
  );
}
