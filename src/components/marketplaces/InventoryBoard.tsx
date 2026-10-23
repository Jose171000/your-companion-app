import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Clock, FileText, LayoutGrid, List, MoreVertical, Pause, Pencil, Play, Power, Search, Trash2 } from "lucide-react";
import { Product } from "@/lib/products-api";
import { ProductSheetDialog } from "@/components/products/ProductSheetDialog";
import { ChangeRequest, ChannelActionType, UserListing } from "@/lib/sync-api";
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

interface Props {
  listings: UserListing[];
  pending: ChangeRequest[];
  reviewMode: boolean;
  /** Los lectores miran; editor y dueño pueden editar */
  canEdit: boolean;
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

function ChannelChip({ cell, canEdit, onAction }: { cell: ChannelCell; canEdit: boolean; onAction: OnChannelAction }) {
  const { listing: l } = cell;
  const estado = estadoVisible(l);
  const drift = estado === "published" && (cell.priceDrift || cell.stockDrift);
  const chip = (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-xs space-y-1 min-w-[132px] max-w-[220px]",
        drift ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-secondary/20",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold truncate">
          {channelName(l.marketplace)}
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
    </div>
  );

  const note = l.lastError || (drift ? "El canal aún no tiene el último precio o stock de Synkro." : null);
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

function PendingBadge({ count, long }: { count: number; long?: boolean }) {
  if (count <= 0) return null;
  return (
    <Badge className="text-[10px] gap-1 bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
      <Clock className="w-3 h-3" />
      {long ? `${count} en revisión` : count}
    </Badge>
  );
}

/** Tablero maestro: precio y stock de cada producto, canal por canal. */
export function InventoryBoard({ listings, pending, reviewMode, canEdit, isLoading, isError }: Props) {
  const [view, setView] = useState<"rows" | "grid">("rows");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EditableProduct | null>(null);
  const [sheetFor, setSheetFor] = useState<Product | null>(null);
  const [channelAction, setChannelAction] = useState<PendingChannelAction | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const alternar = (id: string) => setAbiertos((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const rows = useMemo(() => buildRows(listings, pending), [listings, pending]);
  const items = useMemo(() => buildItems(rows), [rows]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const coincide = (r: Row) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) || (r.variantLabel ?? "").toLowerCase().includes(q);
    if (!q) return items;
    return items.filter((i) => (isGroup(i) ? i.name.toLowerCase().includes(q) || (i.code ?? "").toLowerCase().includes(q) || i.children.some(coincide) : coincide(i)));
  }, [items, search]);

  const askChannelAction = (r: Row): OnChannelAction => (action, listing) =>
    setChannelAction({ productId: r.productId, productName: r.name, action, listing, listings: r.channels.map((c) => c.listing) });

  const renderRow = (r: Row, nested = false) => (
              <div
                key={r.productId}
                className={cn("p-4 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-secondary/20 transition-colors", nested && "lg:pl-10 bg-secondary/10 border-l-2 border-border")}
              >
                <div className="lg:w-72 shrink-0 min-w-0 flex items-center gap-3">
                  <ProductThumb src={r.imageUrl} alt={r.name} />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{nested ? (r.variantLabel ?? r.name) : r.name}</p>
                    {r.variation && <p className="text-[11px] text-muted-foreground truncate">{r.variation}</p>}
                    <code className="text-[10px] font-mono text-muted-foreground">{r.sku}</code>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm tabular-nums lg:w-80 shrink-0">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Precio</p>
                    <p className="font-semibold">{money(r.price, r.channels[0]?.listing.currency)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Stock</p>
                    <p className="font-semibold">{r.stock} u.</p>
                  </div>
                  <WebPrice value={r.webPrice} />
                  <PendingBadge count={r.pendingCount} long />
                </div>
                <div className="flex flex-wrap gap-2 flex-1">
                  {r.channels.map((c) => (
                    <ChannelChip key={c.listing.id} cell={c} canEdit={canEdit} onAction={askChannelAction(r)} />
                  ))}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSheetFor({ id: r.productId, name: r.name } as Product)}>
                    <FileText className="w-3.5 h-3.5" /> Ficha
                  </Button>
                  {canEdit && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(r)}>
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </Button>
                  )}
                  {canEdit && <AllChannelsMenu channels={r.channels} onAction={askChannelAction(r)} />}
                </div>
              </div>
  );

  const renderCard = (r: Row, nested = false) => (
              <div key={r.productId} className="glass rounded-2xl p-4 space-y-3 border border-border">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-3">
                    <ProductThumb src={r.imageUrl} alt={r.name} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{nested ? (r.variantLabel ?? r.name) : r.name}</p>
                      {r.variation && <p className="text-[11px] text-muted-foreground truncate">{r.variation}</p>}
                      <code className="text-[10px] font-mono text-muted-foreground">{r.sku}</code>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSheetFor({ id: r.productId, name: r.name } as Product)} aria-label="Ficha" title="Ficha: lo que se envía a cada canal">
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                    {canEdit && (
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditing(r)} aria-label="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm tabular-nums">
                  <span className="font-semibold">{money(r.price, r.channels[0]?.listing.currency)}</span>
                  <span className="text-muted-foreground">{r.stock} u.</span>
                  <WebPrice value={r.webPrice} />
                  <PendingBadge count={r.pendingCount} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.channels.map((c) => (
                    <ChannelChip key={c.listing.id} cell={c} canEdit={canEdit} onAction={askChannelAction(r)} />
                  ))}
                </div>
                {canEdit && <div className="flex justify-end"><AllChannelsMenu channels={r.channels} onAction={askChannelAction(r)} /></div>}
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
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as "rows" | "grid")}
          aria-label="Vista"
        >
          <ToggleGroupItem value="rows" aria-label="Filas">
            <List className="w-4 h-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Cuadrícula">
            <LayoutGrid className="w-4 h-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {!visible.length && (
        <p className="text-sm text-muted-foreground text-center py-8">Ningún producto coincide con la búsqueda.</p>
      )}

      {view === "rows" ? (
        <div className="glass rounded-2xl overflow-hidden divide-y divide-border/50">
          {visible.map((item) => {
            if (!isGroup(item)) return renderRow(item);
            const abierto = abiertos.has(item.groupId);
            return (
              <div key={item.groupId}>
                <div className="p-4 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => alternar(item.groupId)}>
                  <div className="lg:w-72 shrink-0 min-w-0 flex items-center gap-3">
                    {abierto ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                    <ProductThumb src={item.imageUrl} alt={item.name} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{item.children.length} variantes</Badge>
                      {item.code && <code className="ml-1 text-[10px] font-mono text-muted-foreground">{item.code}</code>}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm tabular-nums lg:w-80 shrink-0">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Precio</p>
                      <p className="font-semibold whitespace-nowrap">{rangoDePrecio(item.children)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Stock</p>
                      <p className="font-semibold">{item.children.reduce((n, c) => n + (c.stock ?? 0), 0)} u.</p>
                    </div>
                  </div>
                  <div className="flex-1"><GroupChannels children={item.children} /></div>
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
              <div key={item.groupId} className={cn("glass rounded-2xl p-4 space-y-3 border border-border", abierto && "md:col-span-2 xl:col-span-3")}>
                <button type="button" className="w-full flex items-start gap-3 text-left" onClick={() => alternar(item.groupId)} aria-expanded={abierto}>
                  <ProductThumb src={item.imageUrl} alt={item.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate" title={item.name}>{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{item.children.length} variantes</Badge>
                      {item.code && <code className="text-[10px] font-mono text-muted-foreground truncate">{item.code}</code>}
                    </div>
                  </div>
                  {abierto ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground mt-1" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground mt-1" />}
                </button>
                <div className="flex items-center gap-6 text-sm tabular-nums">
                  <span className="font-semibold">{rangoDePrecio(item.children)}</span>
                  <span className="text-muted-foreground">{item.children.reduce((n, c) => n + (c.stock ?? 0), 0)} u.</span>
                </div>
                <GroupChannels children={item.children} />
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

      <EditInventoryDialog product={editing} reviewMode={reviewMode} onClose={() => setEditing(null)} />
      <ProductSheetDialog product={sheetFor} onClose={() => setSheetFor(null)} />
      <ChannelActionDialog pending={channelAction} onClose={() => setChannelAction(null)} />
    </div>
  );
}
