import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, History, Loader2, Plus, Search, ShoppingBag } from "lucide-react";
import { MarketplaceConnection, Sale, SaleLine, syncApi } from "@/lib/sync-api";
import { useStores } from "@/contexts/StoreContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { channelName, money } from "./format";
import { ProductThumb } from "./ProductThumb";
import { OrderDetailSheet } from "./OrderDetailSheet";
import { ImportHistoryDialog } from "./ImportHistoryDialog";
import { ManualSaleDialog } from "./ManualSaleDialog";
import { DateRangeFilter, useRangoDeFechas } from "@/components/common/DateRangeFilter";
import { SaleStatusFilter } from "@/components/common/SaleStatusFilter";
import type { SaleState } from "@/lib/sale-status";
import { EstadoDeLaVenta, ShipByBadge, StockCell, fmtDate } from "./SaleParts";

const PAGE = 50;
/** Canales de los que se leen ventas. */
const VENTA_CHANNELS = ["falabella", "mercadolibre", "woocommerce", "shopify"];

interface Row {
  sale: Sale;
  line: SaleLine;
  key: string;
}

interface Props {
  accounts: MarketplaceConnection[];
  /** Solo el dueño de la tienda puede traer el historial */
  canImport?: boolean;
}

/** Todas las ventas de la tienda en una sola lista, una fila por producto vendido. */
export function SalesList({ accounts, canImport }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const { activeStore } = useStores();
  const storeId = activeStore?.id;

  const [rango, setRango] = useRangoDeFechas(30);
  const [marketplace, setMarketplace] = useState("all");
  const [connectionId, setConnectionId] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [estados, setEstados] = useState<SaleState[]>([]);
  const [envio, setEnvio] = useState("all");
  const [selected, setSelected] = useState<Sale | null>(null);

  // La búsqueda espera a que se deje de escribir: una consulta por tecla sobra.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { from, to } = rango;

  const query = useInfiniteQuery({
    queryKey: ["sync-orders", storeId, from, to, marketplace, connectionId, search, estados.join(","), envio],
    placeholderData: keepPreviousData,
    enabled: !!storeId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const res = await syncApi.getSales({
        from,
        to,
        marketplace: marketplace === "all" ? undefined : marketplace,
        connectionId: connectionId === "all" ? undefined : connectionId,
        search: search || undefined,
        status: estados.join(",") || undefined,
        shipping: envio === "all" ? undefined : envio,
        limit: PAGE,
        offset: pageParam,
      });
      if (res.error || !res.data) throw new Error(res.error ?? "No se pudieron cargar las ventas");
      return res.data;
    },
    getNextPageParam: (last) => (last.offset + last.items.length < last.total ? last.offset + last.limit : undefined),
    staleTime: 30_000,
    refetchInterval: 60_000, // las ventas nuevas aparecen solas
  });

  const sales = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  const porEstado = query.data?.pages[0]?.porEstado;
  const rows: Row[] = useMemo(
    () =>
      sales.flatMap((sale) =>
        (sale.lines.length ? sale.lines : [{ sku: null, title: "Sin detalle de productos", quantity: 1, unitPrice: sale.totalAmount, currentStock: null, imageUrl: null, productName: null } as SaleLine]).map(
          (line, i) => ({ sale, line, key: `${sale.id}-${i}` }),
        ),
      ),
    [sales],
  );

  // Baja lo que se ve con los filtros puestos (fechas, canal, cuenta, estado y búsqueda), no solo la página cargada.
  const descargar = async () => {
    if (total > 5000) toast.info("Hay más de 5000 ventas con estos filtros: se descargan las 5000 más recientes. Acota las fechas para el resto.");
    setDescargando(true);
    try {
      await syncApi.downloadSales({
        from, to,
        marketplace: marketplace === "all" ? undefined : marketplace,
        connectionId: connectionId === "all" ? undefined : connectionId,
        search: search || undefined,
        status: estados.join(",") || undefined,
        shipping: envio === "all" ? undefined : envio,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo descargar las ventas");
    } finally {
      setDescargando(false);
    }
  };

  const accountsOfChannel = accounts.filter((a) => marketplace === "all" || a.marketplace === marketplace);
  const conectados = [...new Set(accounts.map((a) => a.marketplace))].filter((m) => VENTA_CHANNELS.includes(m));
  // Canales registrados a mano (Ripley, WhatsApp…): no tienen cuenta conectada, así que salen de las ventas mismas.
  const manuales = [...new Set([...sales.map((s) => s.marketplace), ...(marketplace !== "all" ? [marketplace] : [])])].filter((m) => !conectados.includes(m) && !VENTA_CHANNELS.includes(m));
  const channels = [...conectados, ...manuales];

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter value={rango} onChange={setRango} />
          <Select value={marketplace} onValueChange={(v) => { setMarketplace(v); setConnectionId("all"); }}>
            <SelectTrigger className="h-9 w-48 text-sm"><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los canales</SelectItem>
              {channels.map((c) => <SelectItem key={c} value={c}>{channelName(c)}</SelectItem>)}
            </SelectContent>
          </Select>
          {accountsOfChannel.length > 1 && (
            <Select value={connectionId} onValueChange={setConnectionId}>
              <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="Cuenta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las cuentas</SelectItem>
                {accountsOfChannel.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.label || a.externalNickname || a.externalUserId}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={envio} onValueChange={setEnvio}>
            <SelectTrigger className="h-9 w-48 text-sm"><SelectValue placeholder="Envío" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los envíos</SelectItem>
              <SelectItem value="comprador">Pagado por el cliente</SelectItem>
              <SelectItem value="gratis">Envío gratis para el cliente</SelectItem>
              <SelectItem value="retiro">Retiro en tienda</SelectItem>
              <SelectItem value="sin_dato">Sin dato de envío</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 flex-wrap lg:order-2">
          <Button size="sm" variant="outline" className="gap-1.5" disabled={descargando || total === 0} onClick={descargar}>
            {descargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Descargar
          </Button>
        {canImport && (
          <>
            <Button size="sm" className="gap-1.5" onClick={() => setManualOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Registrar ventas
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setHistoryOpen(true)}>
              <History className="w-3.5 h-3.5" /> Importar historial
            </Button>
          </>
        )}
        </div>
        <div className="relative w-full lg:max-w-sm lg:order-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar cliente, pedido, SKU o producto…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        </div>
      </div>

      {/* Estado de la venta: pendientes, enviadas, entregadas, canceladas o devueltas */}
      <SaleStatusFilter value={estados} onChange={setEstados} counts={porEstado} />

      {query.isLoading ? (
        <div className="glass rounded-2xl divide-y divide-border/50 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-56" /><Skeleton className="h-3 w-32" /></div>
              <Skeleton className="h-6 w-20 hidden md:block" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <div className="glass rounded-2xl py-16 text-center">
          <p className="font-semibold text-muted-foreground">No se pudieron cargar las ventas</p>
          <p className="text-xs text-muted-foreground mt-1">{(query.error as Error)?.message}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => query.refetch()}>Reintentar</Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl flex flex-col items-center py-16 text-center">
          <ShoppingBag className="w-10 h-10 text-muted-foreground opacity-40 mb-3" />
          <h3 className="text-base font-semibold mb-1">{search ? "Ninguna venta coincide con la búsqueda" : "Aún no hay ventas en este periodo"}</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {search
              ? "Prueba con otro cliente, número de pedido o SKU."
              : "Las ventas de tus cuentas conectadas entran solas cada pocos minutos. También puedes forzarlas con «Actualizar ventas ahora» en Analíticas."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {total} {total === 1 ? "venta" : "ventas"} · toca una fila para ver todo el detalle
          </p>

          {/* Escritorio */}
          <div className="hidden lg:block glass rounded-2xl overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  {["Producto", "Cliente", "Pagado", "Stock tras venta", "Stock actual", "Enviar antes de", "Canal", "Fecha", "Estado"].map((h) => (
                    <th key={h} className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map(({ sale, line, key }) => (
                  <tr key={key} className="hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => setSelected(sale)}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <ProductThumb src={line.imageUrl} alt={line.title} />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate max-w-[220px]">{line.productName || line.title}</p>
                          <code className="text-[10px] font-mono text-muted-foreground">{line.sku ?? "sin SKU"}</code>
                          {line.variant && <p className="text-[11px] text-foreground/80 truncate max-w-[220px]" title={line.variant}>{line.variant}</p>}
                          {line.quantity > 1 && <span className="text-[10px] text-muted-foreground"> · x{line.quantity}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm max-w-[160px]">
                      <p className="truncate">{sale.customerName ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">#{sale.orderNumber}</p>
                    </td>
                    <td className="px-3 py-3 text-sm tabular-nums whitespace-nowrap">
                      {money(line.unitPrice * line.quantity, sale.currency)}
                      {line.listPrice != null && line.listPrice > line.unitPrice && (
                        <p className="text-[10px] text-muted-foreground line-through">{money(line.listPrice * line.quantity, sale.currency)}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm"><StockCell value={line.stockAfter} /></td>
                    <td className="px-3 py-3 text-sm"><StockCell value={line.currentStock} low /></td>
                    <td className="px-3 py-3"><ShipByBadge sale={sale} /></td>
                    <td className="px-3 py-3 text-xs">
                      <Badge variant="secondary" className="text-[10px]">{channelName(sale.marketplace)}</Badge>
                      {sale.account?.label && <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-[110px]">{sale.account.label}</p>}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(sale.orderDate)}</td>
                    <td className="px-3 py-3 text-xs">
                      <EstadoDeLaVenta sale={sale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil y tableta */}
          <div className="lg:hidden space-y-3">
            {rows.map(({ sale, line, key }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(sale)}
                className="glass rounded-2xl p-4 w-full text-left space-y-3 border border-border hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <ProductThumb src={line.imageUrl} alt={line.title} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{line.productName || line.title}</p>
                    <code className="text-[10px] font-mono text-muted-foreground">{line.sku ?? "sin SKU"}</code>
                    {line.variant && <p className="text-[11px] text-foreground/80 truncate">{line.variant}</p>}
                  </div>
                  <p className="font-semibold text-sm tabular-nums shrink-0">{money(line.unitPrice * line.quantity, sale.currency)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Cliente</span><p className="truncate">{sale.customerName ?? "—"}</p></div>
                  <div><span className="text-muted-foreground">Enviar antes de</span><div className="mt-0.5"><ShipByBadge sale={sale} /></div></div>
                  <div><span className="text-muted-foreground">Stock tras venta</span><p><StockCell value={line.stockAfter} /></p></div>
                  <div><span className="text-muted-foreground">Stock actual</span><p><StockCell value={line.currentStock} low /></p></div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{channelName(sale.marketplace)}{sale.account?.label ? ` · ${sale.account.label}` : ""} · #{sale.orderNumber}</span>
                  <span>{fmtDate(sale.orderDate, false)}</span>
                </div>
              </button>
            ))}
          </div>

          {query.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
                {query.isFetchingNextPage && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                Ver más ventas
              </Button>
            </div>
          )}
        </>
      )}

      <OrderDetailSheet sale={selected} onClose={() => setSelected(null)} />
      {canImport && <ManualSaleDialog open={manualOpen} onOpenChange={setManualOpen} />}
      {canImport && (
        <ImportHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          accounts={accounts.filter((c) => c.status === "active" && VENTA_CHANNELS.includes(c.marketplace))}
        />
      )}
    </div>
  );
}
