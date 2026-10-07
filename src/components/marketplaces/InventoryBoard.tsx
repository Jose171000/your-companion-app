import { useMemo, useState } from "react";
import { AlertCircle, Clock, LayoutGrid, List, Pencil, Search } from "lucide-react";
import { ChangeRequest, UserListing } from "@/lib/sync-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { channelName, money } from "./format";
import { EditInventoryDialog, EditableProduct } from "./EditInventoryDialog";

interface Props {
  listings: UserListing[];
  pending: ChangeRequest[];
  reviewMode: boolean;
  isLoading: boolean;
  isError: boolean;
}

interface ChannelCell {
  listing: UserListing;
  priceDrift: boolean;
  stockDrift: boolean;
}

interface Row extends EditableProduct {
  channels: ChannelCell[];
  pendingCount: number;
}

const STATUS_STYLES: Record<string, string> = {
  published: "bg-green-500/10 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  paused: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
};
const STATUS_LABELS: Record<string, string> = {
  published: "Publicado",
  pending: "En proceso",
  paused: "Pausado",
  error: "Error",
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
        channels: [],
        pendingCount: pending.filter((p) => p.product.id === l.productId).length,
      };
      byProduct.set(l.productId, row);
    }
    row.channels.push({
      listing: l,
      // Desfasado = el canal quedó con un valor distinto al de Synkro.
      priceDrift: l.lastPriceSynced == null || Number(l.lastPriceSynced) !== Number(l.price),
      stockDrift: l.lastStockSynced == null || l.lastStockSynced !== l.stock,
    });
  }
  return [...byProduct.values()];
}

function ChannelChip({ cell }: { cell: ChannelCell }) {
  const { listing: l } = cell;
  const drift = l.syncStatus === "published" && (cell.priceDrift || cell.stockDrift);
  const chip = (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-xs space-y-1 min-w-[132px]",
        drift ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-secondary/20",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{channelName(l.marketplace)}</span>
        <Badge className={cn("text-[10px] gap-1", STATUS_STYLES[l.syncStatus] ?? STATUS_STYLES.pending)}>
          {l.syncStatus === "error" && <AlertCircle className="w-3 h-3" />}
          {STATUS_LABELS[l.syncStatus] ?? l.syncStatus}
        </Badge>
      </div>
      <div className="flex items-center justify-between text-muted-foreground tabular-nums">
        <span>{l.lastPriceSynced != null ? money(l.lastPriceSynced, l.currency) : "—"}</span>
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
export function InventoryBoard({ listings, pending, reviewMode, isLoading, isError }: Props) {
  const [view, setView] = useState<"rows" | "grid">("rows");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EditableProduct | null>(null);

  const rows = useMemo(() => buildRows(listings, pending), [listings, pending]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

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
          {visible.map((r) => (
            <div
              key={r.productId}
              className="p-4 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-secondary/20 transition-colors"
            >
              <div className="lg:w-64 shrink-0 min-w-0">
                <p className="font-medium text-sm truncate">{r.name}</p>
                <code className="text-[10px] font-mono text-muted-foreground">{r.sku}</code>
              </div>
              <div className="flex items-center gap-6 text-sm tabular-nums lg:w-64 shrink-0">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Precio</p>
                  <p className="font-semibold">{money(r.price, r.channels[0]?.listing.currency)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Stock</p>
                  <p className="font-semibold">{r.stock} u.</p>
                </div>
                <PendingBadge count={r.pendingCount} long />
              </div>
              <div className="flex flex-wrap gap-2 flex-1">
                {r.channels.map((c) => (
                  <ChannelChip key={c.listing.id} cell={c} />
                ))}
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setEditing(r)}>
                <Pencil className="w-3.5 h-3.5" /> Editar
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {visible.map((r) => (
            <div key={r.productId} className="glass rounded-2xl p-4 space-y-3 border border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{r.name}</p>
                  <code className="text-[10px] font-mono text-muted-foreground">{r.sku}</code>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setEditing(r)}
                  aria-label="Editar"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-6 text-sm tabular-nums">
                <span className="font-semibold">{money(r.price, r.channels[0]?.listing.currency)}</span>
                <span className="text-muted-foreground">{r.stock} u.</span>
                <PendingBadge count={r.pendingCount} />
              </div>
              <div className="flex flex-wrap gap-2">
                {r.channels.map((c) => (
                  <ChannelChip key={c.listing.id} cell={c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <EditInventoryDialog product={editing} reviewMode={reviewMode} onClose={() => setEditing(null)} />
    </div>
  );
}
