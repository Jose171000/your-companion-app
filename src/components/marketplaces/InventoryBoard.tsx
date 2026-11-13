import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, ChevronDown, ChevronRight, Clock, ExternalLink, FileText, LayoutGrid, List, MoreVertical, Pause, Pencil, Play, Power, RotateCw, Search, Trash2 } from "lucide-react";
import { Product } from "@/lib/products-api";
import { ProductSheetDialog } from "@/components/products/ProductSheetDialog";
import { ChangeRequest, ChannelActionType, UserListing, syncApi } from "@/lib/sync-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { channelName, money } from "./format";
import { EditInventoryDialog, EditableProduct } from "./EditInventoryDialog";
import { ProductThumb } from "./ProductThumb";
import { ChannelActionDialog, PendingChannelAction, estadoVisible } from "./ChannelActionDialog";
import { BulkResendStockDialog } from "./BulkResendStockDialog";
import { GroupPriceForm } from "./GroupPriceForm";
import { GroupStockForm } from "./GroupStockForm";
import { Calidad, CuentaConectada, calidadDelCatalogo, calidadDelProducto, colorDeCalidad } from "./calidad";
import { CalidadAbierta, CalidadDialog } from "./CalidadDialog";
import { FiltrosDelTableroPanel } from "./FiltrosDelTablero";
import { FILTROS_INICIALES, FiltrosDelTablero, comparador, cumpleFiltros } from "./filtros";
import { mejorasDeCalidad } from "./mejoras";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  /** Cuentas de canal conectadas a la tienda: de ahí sale el porcentaje de calidad. */
  cuentas: CuentaConectada[];
  listings: UserListing[];
  pending: ChangeRequest[];
  reviewMode: boolean;
  /** Cambiar stock y precio (permiso «inventario.editar») */
  canEdit: boolean;
  /** Pausar, reactivar y publicar en los canales («canales.publicar») */
  canPublish: boolean;
  isLoading: boolean;
  isError: boolean;
}

interface ChannelCell {
  listing: UserListing;
  priceDrift: boolean;
  stockDrift: boolean;
}

interface Row extends EditableProduct {
  imageUrl: string | null;
  variation: string | null;
  groupId: string | null;
  groupName: string | null;
  groupCode: string | null;
  /** «Rojo / M»: lo que distingue a esta variante dentro de su grupo */
  variantLabel: string | null;
  channels: ChannelCell[];
  pendingCount: number;
}

const STATUS_STYLES: Record<string, string> = {
  published: "bg-green-500/10 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  paused: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
  removed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};
const STATUS_LABELS: Record<string, string> = {
  published: "Publicado",
  pending: "En proceso",
  paused: "Pausado",
  error: "Error",
  removed: "Retirado",
};

/** Agrupa las publicaciones por producto: una fila por producto, una celda por canal. */
function buildRows(listings: UserListing[], pending: ChangeRequest[]): Row[] {
  const byProduct = new Map<string, Row>();
  for (const l of listings) {
    let row = byProduct.get(l.productId);
    if (!row) {
      row = {
        productId: l.productId,
        name: l.productName,
        sku: l.sku,
        price: Number(l.price),
        stock: l.stock,
        webPrice: l.webPrice != null ? Number(l.webPrice) : null,
        promo: l.promo?.price != null ? { price: Number(l.promo.price), start: l.promo.start ? String(l.promo.start).slice(0, 10) : null, end: l.promo.end ? String(l.promo.end).slice(0, 10) : null } : null,
        imageUrl: null,
        variation: null,
        groupId: l.groupId ?? null,
        groupName: l.groupName ?? null,
        groupCode: l.groupCode ?? null,
        variantLabel: l.variantValues ? Object.values(l.variantValues).join(" / ") : null,
        channels: [],
        pendingCount: pending.filter((p) => p.product.id === l.productId).length,
      };
      byProduct.set(l.productId, row);
    }
    // La imagen y la variante salen de la primera publicación que las tenga.
    row.imageUrl = row.imageUrl ?? l.imageUrl ?? null;
    row.variation = row.variation ?? l.variation ?? null;
    row.channels.push({
      listing: l,
      // Desfasado = el canal quedó con un valor distinto al de Synkro.
      priceDrift: l.lastPriceSynced == null || Number(l.lastPriceSynced) !== Number(l.price),
      stockDrift: l.lastStockSynced == null || l.lastStockSynced !== l.stock,
    });
  }
  return [...byProduct.values()];
}

/** Un producto con variantes: una sola fila que se despliega en sus variantes. */
interface GroupItem {
  group: true;
  groupId: string;
  name: string;
  code: string | null;
  imageUrl: string | null;
  children: Row[];
}
type Item = Row | GroupItem;
const isGroup = (i: Item): i is GroupItem => (i as GroupItem).group === true;

/** Junta las variantes de cada grupo bajo una sola fila; el resto de productos queda como estaba. */
function buildItems(rows: Row[]): Item[] {
  const items: Item[] = [];
  const grupos = new Map<string, GroupItem>();
  for (const r of rows) {
    if (!r.groupId) { items.push(r); continue; }
    let g = grupos.get(r.groupId);
    if (!g) {
      g = { group: true, groupId: r.groupId, name: r.groupName ?? r.name, code: r.groupCode, imageUrl: r.imageUrl, children: [] };
      grupos.set(r.groupId, g);
      items.push(g);
    }
    g.imageUrl = g.imageUrl ?? r.imageUrl;
    g.children.push(r);
  }
  return items;
}

/** Cuántas variantes hay en cada estado, canal por canal: «Falabella: 5 publicado, 1 error». */
function GroupChannels({ children }: { children: Row[] }) {
  const porCanal = new Map<string, { canal: string; estados: Map<string, number> }>();
  for (const r of children) {
    for (const c of r.channels) {
      const clave = `${c.listing.marketplace}|${c.listing.accountLabel ?? ""}`;
      const fila = porCanal.get(clave) ?? { canal: `${channelName(c.listing.marketplace)}${c.listing.accountLabel ? ` · ${c.listing.accountLabel}` : ""}`, estados: new Map<string, number>() };
      const e = estadoVisible(c.listing);
      fila.estados.set(e, (fila.estados.get(e) ?? 0) + 1);
      porCanal.set(clave, fila);
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {[...porCanal.entries()].map(([clave, f]) => (
        <div key={clave} className="rounded-xl border border-border bg-secondary/20 px-3 py-2 text-xs space-y-1 min-w-[132px]">
          <p className="font-semibold truncate">{f.canal}</p>
          <div className="flex flex-wrap gap-1">
            {[...f.estados.entries()].map(([estado, n]) => (
              <Badge key={estado} className={cn("text-[10px] py-0 px-1.5", STATUS_STYLES[estado] ?? STATUS_STYLES.pending)}>
                {n} {(STATUS_LABELS[estado] ?? estado).toLowerCase()}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function rangoDePrecio(children: Row[]): string {
  const precios = children.map((c) => c.price).filter((p) => Number.isFinite(p));
  if (!precios.length) return "—";
  const min = Math.min(...precios);
  const max = Math.max(...precios);
  const moneda = children[0]?.channels[0]?.listing.currency;
  return min === max ? money(min, moneda) : `${money(min, moneda)} – ${money(max, moneda)}`;
}

/** Precio regular y, si hay promoción vigente, el precio con descuento del canal. */
function ChannelPrice({ listing: l }: { listing: UserListing }) {
  const regular = l.regularPrice ?? l.lastPriceSynced;
  if (regular == null) return <span>—</span>;
  if (l.salePrice == null) return <span>{money(regular, l.currency)}</span>;
  return (
    <span className="flex flex-col leading-tight">
      <span className="line-through text-[10px] opacity-70">{money(regular, l.currency)}</span>
      <span className="font-semibold text-foreground">{money(l.salePrice, l.currency)}</span>
    </span>
  );
}

function WebPrice({ value }: { value?: number | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Precio web</p>
      {value != null ? (
        <p className="font-semibold">{money(value)}</p>
      ) : (
        <p className="text-muted-foreground">—</p>
      )}
    </div>
  );
}

type OnChannelAction = (action: ChannelActionType, listing?: UserListing) => void;

/** Menú de un canal: pausar o reanudar, y quitar el producto de ese canal. */
function ChannelMenu({ listing: l, onAction }: { listing: UserListing; onAction: OnChannelAction }) {
  const estado = estadoVisible(l);
  const puedePausar = estado === "published";
  const puedeReanudar = estado === "paused";
  const puedeQuitar = estado === "published" || estado === "paused" || estado === "error";
  if (!puedePausar && !puedeReanudar && !puedeQuitar) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`Acciones en ${channelName(l.marketplace)}`}>
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {puedePausar && <DropdownMenuItem onSelect={() => onAction("pause", l)}><Pause className="w-3.5 h-3.5 mr-2" /> Pausar en {channelName(l.marketplace)}</DropdownMenuItem>}
        {puedeReanudar && <DropdownMenuItem onSelect={() => onAction("resume", l)}><Play className="w-3.5 h-3.5 mr-2" /> Reanudar en {channelName(l.marketplace)}</DropdownMenuItem>}
        {puedeQuitar && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-400 focus:text-red-400" onSelect={() => onAction("remove", l)}><Trash2 className="w-3.5 h-3.5 mr-2" /> Quitar de {channelName(l.marketplace)}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Botón general: la misma acción en todos los canales del producto a la vez. */
function AllChannelsMenu({ channels, onAction }: { channels: ChannelCell[]; onAction: OnChannelAction }) {
  const estados = channels.map((c) => estadoVisible(c.listing));
  const hayActivas = estados.includes("published");
  const hayPausadas = estados.includes("paused");
  const hayQuitables = estados.some((e) => e === "published" || e === "paused" || e === "error");
  if (!hayActivas && !hayPausadas && !hayQuitables) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><Power className="w-3.5 h-3.5" /> Canales</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {hayActivas && <DropdownMenuItem onSelect={() => onAction("pause")}><Pause className="w-3.5 h-3.5 mr-2" /> Pausar en todos los canales</DropdownMenuItem>}
        {hayPausadas && <DropdownMenuItem onSelect={() => onAction("resume")}><Play className="w-3.5 h-3.5 mr-2" /> Reanudar en todos</DropdownMenuItem>}
        {hayQuitables && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-400 focus:text-red-400" onSelect={() => onAction("remove")}><Trash2 className="w-3.5 h-3.5 mr-2" /> Quitar de todos los canales</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChannelChip({ cell, className, canEdit, canResend, onAction }: { cell: ChannelCell; className?: string; canEdit: boolean; canResend: boolean; onAction: OnChannelAction }) {
  const { listing: l } = cell;
  const estado = estadoVisible(l);
  const drift = estado === "published" && (cell.priceDrift || cell.stockDrift);
  const queryClient = useQueryClient();
  // El canal tiene un stock distinto al de Synkro: se puede volver a mandar el de Synkro a ESTA cuenta.
  // (En Ripley el envío está en piloto: el servidor avisa si ese SKU todavía no está habilitado.)
  const puedeReenviar = canResend && estado === "published" && cell.stockDrift && l.lastStockSynced != null;
  const reenviar = useMutation({
    mutationFn: () => syncApi.resendListingStock(l.id),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error); return; }
      toast.success(res.data?.message ?? "Reenvío programado");
      queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
      queryClient.invalidateQueries({ queryKey: ["sync-change-requests"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });
  // Ripley: el precio normal de la oferta es distinto al de Synkro (las ofertas con rebaja en Ripley no se tocan).
  const puedeReenviarPrecio = canResend && estado === "published" && l.marketplace === "ripley" && cell.priceDrift && l.lastPriceSynced != null && l.salePrice == null;
  const reenviarPrecio = useMutation({
    mutationFn: () => syncApi.resendListingPrice(l.id),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error); return; }
      toast.success(res.data?.message ?? "Reenvío programado");
      queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
      queryClient.invalidateQueries({ queryKey: ["sync-change-requests"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });
  const chip = (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-xs space-y-1 min-w-[132px] max-w-[220px]",
        drift ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-secondary/20",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold truncate">
          {l.permalink ? (
            // Enlace directo a la publicación en el canal.
            <a
              href={l.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:underline"
              title={`Abrir la publicación en ${channelName(l.marketplace)}`}
              onClick={(e) => e.stopPropagation()}
            >
              {channelName(l.marketplace)}
              <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
            </a>
          ) : channelName(l.marketplace)}
          {l.accountLabel && <span className="font-normal text-muted-foreground"> · {l.accountLabel}</span>}
        </span>
        <div className="flex items-center gap-1">
          <Badge className={cn("text-[10px] gap-1", STATUS_STYLES[estado] ?? STATUS_STYLES.pending)}>
            {estado === "error" && <AlertCircle className="w-3 h-3" />}
            {STATUS_LABELS[estado] ?? estado}
          </Badge>
          {canEdit && <ChannelMenu listing={l} onAction={onAction} />}
        </div>
      </div>
      <div className="flex items-end justify-between gap-2 text-muted-foreground tabular-nums">
        <ChannelPrice listing={l} />
        <span>{l.lastStockSynced ?? "—"} u.</span>
      </div>
      {puedeReenviar && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-full gap-1 px-2 text-[11px] text-foreground"
          disabled={reenviar.isPending}
          onClick={(e) => { e.stopPropagation(); reenviar.mutate(); }}
          title={`El canal tiene ${l.lastStockSynced} u. y Synkro tiene ${l.stock} u.`}
        >
          <RotateCw className={cn("w-3 h-3", reenviar.isPending && "animate-spin")} /> Reenviar {l.stock} u.
        </Button>
      )}
      {puedeReenviarPrecio && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-full gap-1 px-2 text-[11px] text-foreground"
          disabled={reenviarPrecio.isPending}
          onClick={(e) => { e.stopPropagation(); reenviarPrecio.mutate(); }}
          title={`El canal tiene ${money(l.lastPriceSynced, l.currency)} y Synkro tiene ${money(l.price, l.currency)}`}
        >
          <RotateCw className={cn("w-3 h-3", reenviarPrecio.isPending && "animate-spin")} /> Reenviar {money(l.price, l.currency)}
        </Button>
      )}
    </div>
  );

  const note = l.lastError || (drift ? (cell.stockDrift ? `El canal tiene ${l.lastStockSynced ?? "—"} u. y Synkro tiene ${l.stock} u.` : "El canal aún no tiene el último precio de Synkro.") : null);
  if (!note) return chip;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{note}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Porcentaje de calidad: al hacer clic se abre qué le falta para llegar al 100 %. */
function CalidadBadge({ calidad, texto, onClick }: { calidad: Calidad; texto?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      title="Ver cómo llegar al 100 % de calidad"
      aria-label={`${texto ?? "Calidad"} ${calidad.porcentaje} %. Ver cómo llegar al 100 %`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <Badge className={cn("text-[10px] tabular-nums cursor-pointer hover:brightness-125", colorDeCalidad(calidad.porcentaje))}>
        {texto ?? "Calidad"} {calidad.porcentaje}%
        <ChevronRight className="w-3 h-3 -mr-0.5" />
      </Badge>
    </button>
  );
}

function PendingBadge({ count, long }: { count: number; long?: boolean }) {
  if (count <= 0) return null;
  return (
    <Badge className="text-[10px] gap-1 bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
      <Clock className="w-3 h-3" />
      {long ? `${count} en revisión` : count}
    </Badge>
  );
}

/** Un dato con su rótulo: «Precio S/ 63.00». */
function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{rotulo}</p>
      <div className="text-sm font-semibold tabular-nums">{children}</div>
    </div>
  );
}

/** Tablero maestro: precio y stock de cada producto, canal por canal. */
export function InventoryBoard({ cuentas, listings, pending, reviewMode, canEdit, canPublish, isLoading, isError }: Props) {
  // La cuadrícula es la vista por defecto: en el celular y en pantallas grandes se lee mejor que las filas.
  const [view, setView] = useState<"rows" | "grid">("grid");
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<FiltrosDelTablero>(FILTROS_INICIALES);
  const [editing, setEditing] = useState<{ product: EditableProduct; modo: "stock" | "precios" } | null>(null);
  const [stockDeGrupo, setStockDeGrupo] = useState<{ name: string; children: Row[] } | null>(null);
  const [calidadAbierta, setCalidadAbierta] = useState<CalidadAbierta | null>(null);
  const [sheetFor, setSheetFor] = useState<Product | null>(null);
  const [channelAction, setChannelAction] = useState<PendingChannelAction | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [reenvioMasivo, setReenvioMasivo] = useState(false);
  const [precioDeGrupo, setPrecioDeGrupo] = useState<{ groupId: string; name: string; n: number } | null>(null);
  const alternar = (id: string) => setAbiertos((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const rows = useMemo(() => buildRows(listings, pending), [listings, pending]);
  // Calidad de cada producto (activo en cuántas de las cuentas conectadas) y resumen del catálogo.
  const calidadPorId = useMemo(
    () => new Map(rows.map((r) => [r.productId, calidadDelProducto(r.channels.map((c) => c.listing), cuentas, estadoVisible)])),
    [rows, cuentas],
  );
  const calidadDe = (r: Row): Calidad => calidadPorId.get(r.productId) ?? calidadDelProducto(r.channels.map((c) => c.listing), cuentas, estadoVisible);
  const calidadDeFilas = (filas: Row[]): Calidad => {
    const hijas = filas.map(calidadDe);
    const total = Math.max(...hijas.map((h) => h.total), 1);
    return { porcentaje: calidadDelCatalogo(hijas), activas: Math.round(hijas.reduce((n, h) => n + h.activas, 0) / Math.max(hijas.length, 1)), total, faltan: [...new Set(hijas.flatMap((h) => h.faltan))] };
  };
  const resumen = useMemo(() => {
    const calidades = [...calidadPorId.values()];
    return {
      calidad: calidadDelCatalogo(calidades),
      productos: rows.length,
      activas: calidades.reduce((n, c) => n + c.activas, 0),
      posibles: calidades.reduce((n, c) => n + c.total, 0),
      sinStock: rows.filter((r) => r.stock <= 0).length,
      sinPublicar: calidades.filter((c) => c.activas === 0).length,
    };
  }, [calidadPorId, rows]);
  const abrirCalidad = (filas: Row[], nombre: string, detalle?: string) =>
    setCalidadAbierta({ nombre, detalle, calidad: filas.length === 1 ? calidadDe(filas[0]) : calidadDeFilas(filas), mejoras: mejorasDeCalidad(filas, cuentas, estadoVisible) });

  // Publicaciones activas cuyo canal tiene un stock distinto al de Synkro (las mismas que muestran «Reenviar»).
  const desfasadas = useMemo(
    () => rows.flatMap((r) => r.channels.filter((c) => estadoVisible(c.listing) === "published" && c.stockDrift && c.listing.lastStockSynced != null)),
    [rows],
  );
  // Ripley: ofertas sin rebaja cuyo precio normal es distinto al de Synkro.
  const desfasadasPrecio = useMemo(
    () => rows.flatMap((r) => r.channels.filter((c) => estadoVisible(c.listing) === "published" && c.listing.marketplace === "ripley" && c.priceDrift && c.listing.lastPriceSynced != null && c.listing.salePrice == null)),
    [rows],
  );

  // Primero los filtros (sobre cada producto), luego se juntan las variantes en su grupo, luego la búsqueda y el orden.
  const filas = useMemo(() => rows.filter((r) => cumpleFiltros(r, calidadDe(r), filtros, estadoVisible)), [rows, filtros, calidadPorId]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => buildItems(filas), [filas]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const coincide = (r: Row) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) || (r.variantLabel ?? "").toLowerCase().includes(q);
    const lista = !q ? items : items.filter((i) => (isGroup(i) ? i.name.toLowerCase().includes(q) || (i.code ?? "").toLowerCase().includes(q) || i.children.some(coincide) : coincide(i)));
    const stockDe = (i: Item) => (isGroup(i) ? i.children.reduce((n, c) => n + (c.stock ?? 0), 0) : i.stock);
    const precioDe = (i: Item) => (isGroup(i) ? Math.min(...i.children.map((c) => c.price)) : i.price);
    const calidadItem = (i: Item) => (isGroup(i) ? calidadDeFilas(i.children).porcentaje : calidadDe(i).porcentaje);
    return [...lista].sort(comparador<Item>(filtros.orden, { nombre: (i) => i.name, calidad: calidadItem, stock: stockDe, precio: precioDe }));
  }, [items, search, filtros.orden, calidadPorId]); // eslint-disable-line react-hooks/exhaustive-deps
  const mostrados = visible.reduce((n, i) => n + (isGroup(i) ? i.children.length : 1), 0);

  const askChannelAction = (r: Row): OnChannelAction => (action, listing) =>
    setChannelAction({ productId: r.productId, productName: r.name, action, listing, listings: r.channels.map((c) => c.listing) });

  /** Los dos botones de edición de un producto: cada uno abre su propio formulario y se aprueba por separado. */
  const botonesDeEdicion = (r: Row, ancho = false) => canEdit && (
    <>
      <Button variant="outline" size="sm" className={cn("gap-1.5", ancho && "flex-1")} onClick={() => setEditing({ product: r, modo: "stock" })}>
        <Pencil className="w-3.5 h-3.5" /> Editar stock
      </Button>
      <Button variant="outline" size="sm" className={cn("gap-1.5", ancho && "flex-1")} onClick={() => setEditing({ product: r, modo: "precios" })}>
        <Pencil className="w-3.5 h-3.5" /> Editar precios
      </Button>
    </>
  );
  const botonesDeGrupo = (item: GroupItem, ancho = false) => canEdit && (
    <>
      <Button variant="outline" size="sm" className={cn("gap-1.5", ancho && "flex-1")} onClick={(e) => { e.stopPropagation(); setStockDeGrupo({ name: item.name, children: item.children }); }}>
        <Pencil className="w-3.5 h-3.5" /> Stock de todas
      </Button>
      <Button variant="outline" size="sm" className={cn("gap-1.5", ancho && "flex-1")} onClick={(e) => { e.stopPropagation(); setPrecioDeGrupo({ groupId: item.groupId, name: item.name, n: item.children.length }); }}>
        <Pencil className="w-3.5 h-3.5" /> Precio de todas
      </Button>
    </>
  );

  const renderRow = (r: Row, nested = false) => (
              <div
                key={r.productId}
                className={cn("p-4 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-secondary/20 transition-colors", nested && "lg:pl-10 bg-secondary/10 border-l-2 border-border")}
              >
                <div className="lg:w-64 shrink-0 min-w-0 flex items-center gap-3">
                  <ProductThumb src={r.imageUrl} alt={r.name} />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{nested ? (r.variantLabel ?? r.name) : r.name}</p>
                    {r.variation && <p className="text-[11px] text-muted-foreground truncate">{r.variation}</p>}
                    <code className="text-[10px] font-mono text-muted-foreground">{r.sku}</code>
                  </div>
                </div>
                <div className="flex items-center gap-5 flex-wrap lg:w-80 shrink-0">
                  <Dato rotulo="Precio">{money(r.price, r.channels[0]?.listing.currency)}</Dato>
                  <Dato rotulo="Stock">{r.stock} u.</Dato>
                  <Dato rotulo="Precio web">{r.webPrice != null ? money(r.webPrice) : <span className="text-muted-foreground">—</span>}</Dato>
                  <div className="flex flex-col items-start gap-1">
                    <CalidadBadge calidad={calidadDe(r)} onClick={() => abrirCalidad([r], r.name, r.sku)} />
                    <PendingBadge count={r.pendingCount} long />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 flex-1">
                  {r.channels.map((c) => (
                    <ChannelChip key={c.listing.id} cell={c} canEdit={canPublish} canResend={canEdit} onAction={askChannelAction(r)} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0 max-w-full">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSheetFor({ id: r.productId, name: r.name } as Product)}>
                    <FileText className="w-3.5 h-3.5" /> Ficha
                  </Button>
                  {botonesDeEdicion(r)}
                  {canPublish && <AllChannelsMenu channels={r.channels} onAction={askChannelAction(r)} />}
                </div>
              </div>
  );

  const renderCard = (r: Row, nested = false) => (
              <div key={r.productId} className="glass rounded-2xl p-4 space-y-3 border border-border min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-3">
                    <ProductThumb src={r.imageUrl} alt={r.name} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm line-clamp-2 break-words" title={nested ? (r.variantLabel ?? r.name) : r.name}>{nested ? (r.variantLabel ?? r.name) : r.name}</p>
                      {r.variation && <p className="text-[11px] text-muted-foreground truncate">{r.variation}</p>}
                      <code className="text-[10px] font-mono text-muted-foreground">{r.sku}</code>
                    </div>
                  </div>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSheetFor({ id: r.productId, name: r.name } as Product)} aria-label="Ficha" title="Ficha: lo que se envía a cada canal">
                    <FileText className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Dato rotulo="Precio">{money(r.price, r.channels[0]?.listing.currency)}</Dato>
                  <Dato rotulo="Stock">{r.stock} u.</Dato>
                  <Dato rotulo="Web">{r.webPrice != null ? money(r.webPrice) : <span className="text-muted-foreground">—</span>}</Dato>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CalidadBadge calidad={calidadDe(r)} onClick={() => abrirCalidad([r], r.name, r.sku)} />
                  <PendingBadge count={r.pendingCount} long />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {r.channels.map((c) => (
                    <ChannelChip key={c.listing.id} cell={c} className="w-full max-w-none" canEdit={canPublish} canResend={canEdit} onAction={askChannelAction(r)} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {botonesDeEdicion(r, true)}
                  {canPublish && <AllChannelsMenu channels={r.channels} onAction={askChannelAction(r)} />}
                </div>
              </div>
  );

  if (isLoading) {
    return (
      <div className="glass rounded-2xl overflow-hidden divide-y divide-border/50">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-32 ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass rounded-2xl flex flex-col items-center py-16 text-center">
        <p className="font-semibold text-muted-foreground">Error al cargar el tablero</p>
        <p className="text-xs text-muted-foreground mt-1">Revisa tu conexión o vuelve a intentarlo</p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="glass rounded-2xl flex flex-col items-center py-16 text-center">
        <h3 className="text-base font-semibold mb-1">Aún no hay productos publicados</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Publica tus productos en un canal y aquí podrás ver y editar su precio y stock en todos a la vez.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen del catálogo: qué tan completo está el alcance de los productos en las cuentas conectadas. */}
      <div className="glass rounded-2xl p-4 grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-x-8 gap-y-3">
        <div className="col-span-2 sm:col-span-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Calidad del catálogo</p>
          <p className={cn("text-2xl font-bold tabular-nums", resumen.calidad >= 80 ? "text-green-400" : resumen.calidad >= 50 ? "text-yellow-400" : "text-red-400")}>{resumen.calidad}%</p>
          <p className="text-[11px] text-muted-foreground">Publicaciones activas ÷ cuentas conectadas</p>
        </div>
        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Productos</p><p className="text-lg font-semibold tabular-nums">{resumen.productos}</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Publicaciones activas</p><p className="text-lg font-semibold tabular-nums">{resumen.activas} / {resumen.posibles}</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sin stock</p><p className={cn("text-lg font-semibold tabular-nums", resumen.sinStock > 0 && "text-yellow-400")}>{resumen.sinStock}</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sin publicar</p><p className={cn("text-lg font-semibold tabular-nums", resumen.sinPublicar > 0 && "text-red-400")}>{resumen.sinPublicar}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-sm min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0 mr-auto sm:mr-0 sm:ml-auto" onClick={() => setReenvioMasivo(true)}>
            <RotateCw className="w-3.5 h-3.5" /> Reenviar<span className="hidden sm:inline"> stock o precio</span>{desfasadas.length + desfasadasPrecio.length > 0 ? ` (${desfasadas.length + desfasadasPrecio.length})` : ""}
          </Button>
        )}
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as "rows" | "grid")}
          aria-label="Vista"
          className="shrink-0"
        >
          <ToggleGroupItem value="grid" aria-label="Cuadrícula">
            <LayoutGrid className="w-4 h-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="rows" aria-label="Filas">
            <List className="w-4 h-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <FiltrosDelTableroPanel filtros={filtros} onChange={setFiltros} cuentas={cuentas} mostrados={mostrados} total={rows.length} />

      {!visible.length && (
        <p className="text-sm text-muted-foreground text-center py-8">Ningún producto coincide con los filtros o la búsqueda.</p>
      )}

      {view === "rows" ? (
        <div className="glass rounded-2xl overflow-hidden divide-y divide-border/50">
          {visible.map((item) => {
            if (!isGroup(item)) return renderRow(item);
            const abierto = abiertos.has(item.groupId);
            return (
              <div key={item.groupId}>
                <div className="p-4 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => alternar(item.groupId)}>
                  <div className="lg:w-64 shrink-0 min-w-0 flex items-center gap-3">
                    {abierto ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                    <ProductThumb src={item.imageUrl} alt={item.name} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{item.children.length} variantes</Badge>
                      {item.code && <code className="ml-1 text-[10px] font-mono text-muted-foreground">{item.code}</code>}
                    </div>
                  </div>
                  <div className="flex items-center gap-5 flex-wrap lg:w-80 shrink-0">
                    <Dato rotulo="Precio"><span className="whitespace-nowrap">{rangoDePrecio(item.children)}</span></Dato>
                    <Dato rotulo="Stock total">{item.children.reduce((n, c) => n + (c.stock ?? 0), 0)} u.</Dato>
                    <CalidadBadge calidad={calidadDeFilas(item.children)} texto="Calidad prom." onClick={() => abrirCalidad(item.children, item.name, `${item.children.length} variantes`)} />
                  </div>
                  <div className="flex-1"><GroupChannels children={item.children} /></div>
                  <div className="flex flex-wrap gap-2 sm:shrink-0">{botonesDeGrupo(item)}</div>
                  <span className="text-xs text-muted-foreground shrink-0">{abierto ? "Ocultar" : "Ver variantes"}</span>
                </div>
                {abierto && item.children.map((c) => renderRow(c, true))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {visible.map((item) => {
            if (!isGroup(item)) return renderCard(item);
            const abierto = abiertos.has(item.groupId);
            return (
              // Cerrado es una tarjeta más de la cuadrícula; abierto ocupa todo el ancho para mostrar sus variantes.
              <div key={item.groupId} className={cn("glass rounded-2xl p-4 space-y-3 border border-border min-w-0", abierto && "md:col-span-2 xl:col-span-3")}>
                <button type="button" className="w-full flex items-start gap-3 text-left" onClick={() => alternar(item.groupId)} aria-expanded={abierto}>
                  <ProductThumb src={item.imageUrl} alt={item.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm line-clamp-2 break-words" title={item.name}>{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{item.children.length} variantes</Badge>
                      {item.code && <code className="text-[10px] font-mono text-muted-foreground truncate">{item.code}</code>}
                    </div>
                  </div>
                  {abierto ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground mt-1" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground mt-1" />}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <Dato rotulo="Precio"><span className="whitespace-nowrap">{rangoDePrecio(item.children)}</span></Dato>
                  <Dato rotulo="Stock total">{item.children.reduce((n, c) => n + (c.stock ?? 0), 0)} u.</Dato>
                </div>
                <CalidadBadge calidad={calidadDeFilas(item.children)} texto="Calidad prom." onClick={() => abrirCalidad(item.children, item.name, `${item.children.length} variantes`)} />
                <GroupChannels children={item.children} />
                <div className="flex flex-wrap gap-2">{botonesDeGrupo(item, true)}</div>
                {abierto && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 pt-1">
                    {item.children.map((c) => renderCard(c, true))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={precioDeGrupo !== null} onOpenChange={(o) => !o && setPrecioDeGrupo(null)}>
        <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>Precio de todas las variantes</DialogTitle>
            <DialogDescription className="break-words">{precioDeGrupo?.name} · {precioDeGrupo?.n} variantes. Lo que cambies aquí se aplica a todas.</DialogDescription>
          </DialogHeader>
          {precioDeGrupo && <GroupPriceForm groupId={precioDeGrupo.groupId} />}
        </DialogContent>
      </Dialog>
      <Dialog open={stockDeGrupo !== null} onOpenChange={(o) => !o && setStockDeGrupo(null)}>
        <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>Stock de todas las variantes</DialogTitle>
            <DialogDescription className="break-words">{stockDeGrupo?.name} · {stockDeGrupo?.children.length} variantes. Cambia el stock de cada una, o pon el mismo número en todas.</DialogDescription>
          </DialogHeader>
          {stockDeGrupo && (
            <GroupStockForm
              reviewMode={reviewMode}
              onDone={() => setStockDeGrupo(null)}
              variantes={stockDeGrupo.children.map((c) => ({ productId: c.productId, sku: c.sku, etiqueta: c.variantLabel ?? c.name, stock: c.stock }))}
            />
          )}
        </DialogContent>
      </Dialog>
      <EditInventoryDialog product={editing?.product ?? null} reviewMode={reviewMode} modo={editing?.modo ?? "precios"} onClose={() => setEditing(null)} />
      <CalidadDialog abierta={calidadAbierta} onClose={() => setCalidadAbierta(null)} />
      <ProductSheetDialog product={sheetFor} onClose={() => setSheetFor(null)} />
      <ChannelActionDialog pending={channelAction} onClose={() => setChannelAction(null)} />
      <BulkResendStockDialog open={reenvioMasivo} onOpenChange={setReenvioMasivo} candidatos={desfasadas} candidatosPrecio={desfasadasPrecio} />
    </div>
  );
}
