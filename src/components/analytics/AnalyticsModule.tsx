import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useStores } from "@/contexts/StoreContext";
import { syncApi } from "@/lib/sync-api";
import { reportsApi, type OrdenDeGanadores } from "@/lib/admin-api";
import { ProductosGanadores } from "./ProductosGanadores";
import { pedirDestino } from "@/lib/aviso-destino";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmbeddedReport } from "./EmbeddedReport";
import { DateRangeFilter, useRangoDeFechas } from "@/components/common/DateRangeFilter";
import { SaleStatusFilter } from "@/components/common/SaleStatusFilter";
import type { SaleState } from "@/lib/sale-status";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MapaDeCalor } from "./MapaDeCalor";
import { EnviosYCupones } from "./EnviosYCupones";
import { cn } from "@/lib/utils";
import { AlertCircle, ArrowRight, Download, FileSpreadsheet, FileText, ListChecks, Loader2, Package, Receipt, RefreshCw, TrendingUp } from "lucide-react";
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
  CHANNEL_NAMES[id] ?? id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

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
  const [rango, setRango] = useRangoDeFechas(30);
  const queryClient = useQueryClient();
  // Las analíticas son de la tienda activa: cada tienda tiene sus propias métricas.
  const { activeStore, can } = useStores();
  const storeId = activeStore?.id;
  const puedeSincronizar = can("ventas.registrar");

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

  const { from, to } = rango;
  const [estados, setEstados] = useState<SaleState[]>([]);
  // Por defecto las ventas son todo lo que pagó el cliente: productos y envío.
  const [incluirEnvio, setIncluirEnvio] = useState(true);
  // Cómo se ordenan los productos ganadores (también lo usa el reporte descargable).
  const [ordenGanadores, setOrdenGanadores] = useState<OrdenDeGanadores>("units");
  const [descargando, setDescargando] = useState<"xlsx" | "pdf" | null>(null);
  const [descargandoVentas, setDescargandoVentas] = useState(false);
  // Cada pedido con su cliente, producto y estado, de las mismas fechas y estados que se están viendo.
  const descargarVentas = async () => {
    setDescargandoVentas(true);
    try {
      await syncApi.downloadSales({ from, to, status: estados.join(",") || undefined });
      toast.success("Ventas desglosadas descargadas");
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "No se pudieron descargar las ventas");
    } finally {
      setDescargandoVentas(false);
    }
  };
  const verVentas = () =>
    pedirDestino({ seccion: "marketplaces", partes: { marketplaces: { pestana: "ventas" }, salesFilter: { from, to, estados } } });
  const descargar = async (formato: "xlsx" | "pdf") => {
    setDescargando(formato);
    try {
      await reportsApi.downloadReport(formato, { from, to, status: estados.join(",") || undefined, includeShipping: incluirEnvio, sort: ordenGanadores });
      toast.success(formato === "pdf" ? "Reporte en PDF descargado" : "Reporte en Excel descargado");
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "No se pudo descargar el reporte");
    } finally {
      setDescargando(null);
    }
  };

  const { data: result, isLoading, isError } = useQuery({
    queryKey: ["sales-report", storeId, from, to, estados.join(","), incluirEnvio],
    queryFn: () => reportsApi.getSales(from, to, estados.join(",") || undefined, incluirEnvio),
    // Al cambiar el filtro se siguen viendo los números anteriores hasta que lleguen los nuevos.
    placeholderData: keepPreviousData,
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
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={descargando !== null}>
                {descargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Descargar reporte
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => descargar("xlsx")}>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> Excel (para trabajar los datos)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => descargar("pdf")}>
                <FileText className="w-3.5 h-3.5 mr-2" /> PDF (con gráficos y fotos)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {puedeSincronizar && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={syncOrders.isPending}
              onClick={() => syncOrders.mutate()}
            >
              {syncOrders.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Actualizar ventas ahora
            </Button>
          )}
        </div>
      </div>

      {/* Selector de rango */}
      <div className="flex flex-col gap-3">
        <DateRangeFilter value={rango} onChange={setRango} />
        {/* Solo pedidos en ciertos estados: entregados, enviados, cancelados o devueltos (igual que en cada canal) */}
        <SaleStatusFilter
          value={estados}
          onChange={setEstados}
          counts={Object.fromEntries((report.byStatus ?? []).map((e) => [e.status, e.orders]))}
        />
        {/* Sin «costos.ver» no se ve el envío: las ventas son solo los productos y no hay nada que incluir */}
        {!report.costsHidden && (
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer w-fit">
            <Switch checked={incluirEnvio} onCheckedChange={setIncluirEnvio} aria-label="Incluir el envío en las ventas" />
            <span>Incluir envío</span>
            <span className="text-xs text-muted-foreground">{incluirEnvio ? "Ventas = productos + envío que pagó el cliente" : "Ventas = solo el precio de los productos"}</span>
          </label>
        )}
        {estados.length > 0 && report.sources.sheets && (
          <p className="text-xs text-muted-foreground">Con un estado elegido no se incluyen las ventas del Google Sheet, porque no tiene estado.</p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={TrendingUp} label="Ventas del periodo" value={money(report.totals.sales)} hint={incluirEnvio && !report.costsHidden ? "Lo que pagó el cliente: productos + envío" : "Solo productos, sin envío"} />
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

      {/* Lo más vendido, con su stock y en cuánto se agota */}
      <ProductosGanadores
        storeId={storeId}
        from={from}
        to={to}
        status={estados.join(",") || undefined}
        orden={ordenGanadores}
        onOrdenChange={setOrdenGanadores}
      />

      {/* Ventas desglosadas: bajarlas en Excel o revisarlas en Marketplaces › Ventas */}
      {(can("ventas.descargar") || can("ventas.ver")) && (
        <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FCCB34]/15 flex items-center justify-center shrink-0">
              <ListChecks className="w-5 h-5 text-[#FCCB34]" />
            </div>
            <div>
              <h3 className="font-semibold">Ventas desglosadas</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                Cada venta con su cliente, producto, SKU, canal, estado y envío, del {report.range.from} al {report.range.to}
                {estados.length > 0 ? " (con los estados elegidos)" : ""}: {report.totals.orders} {report.totals.orders === 1 ? "pedido" : "pedidos"}.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {can("ventas.descargar") && (
              <Button variant="outline" size="sm" className="gap-1.5" disabled={descargandoVentas} onClick={descargarVentas}>
                {descargandoVentas ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                Descargar ventas desglosadas (Excel)
              </Button>
            )}
            {can("ventas.ver") && (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={verVentas}>
                Revisar las ventas desglosadas <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Cuándo entran más ventas */}
      <MapaDeCalor celdas={report.heatmap ?? []} />

      {/* Envío y cupones */}
      {!report.costsHidden && report.shipping && report.discounts && (
        <EnviosYCupones envio={report.shipping} cupones={report.discounts} incluirEnvio={incluirEnvio} />
      )}

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
