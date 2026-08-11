import { UserListing } from "@/lib/sync-api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertCircle, ExternalLink, Store } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ListingsTableProps {
  listings: UserListing[];
  isLoading: boolean;
  isError: boolean;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  published: { label: "Publicado",  className: "bg-green-500/10 text-green-400 border-green-500/30" },
  pending:   { label: "En proceso", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  paused:    { label: "Pausado",    className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  error:     { label: "Error",      className: "bg-red-500/10 text-red-400 border-red-500/30" },
};

function StatusBadge({ listing }: { listing: UserListing }) {
  const style = STATUS_STYLES[listing.syncStatus] ?? STATUS_STYLES.pending;
  const badge = (
    <Badge className={cn("text-[10px] gap-1", style.className)}>
      {listing.syncStatus === "error" && <AlertCircle className="w-3 h-3" />}
      {style.label}
    </Badge>
  );

  if (listing.syncStatus === "error" && listing.lastError) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{listing.lastError}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return badge;
}

// ─── Table ────────────────────────────────────────────────────────────────────

export function ListingsTable({ listings, isLoading, isError }: ListingsTableProps) {
  if (isLoading) {
    return (
      <div className="glass rounded-2xl overflow-hidden divide-y divide-border/50">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-20 hidden md:block" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass rounded-2xl flex flex-col items-center justify-center py-16 text-center">
        <Store className="w-12 h-12 text-muted-foreground mb-4 opacity-40" />
        <p className="font-semibold text-muted-foreground">Error al cargar las publicaciones</p>
        <p className="text-xs text-muted-foreground mt-1">Revisa tu conexión o vuelve a intentarlo</p>
      </div>
    );
  }

  if (!listings.length) {
    return (
      <div className="glass rounded-2xl flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
          <Store className="w-8 h-8 text-muted-foreground opacity-50" />
        </div>
        <h3 className="text-base font-semibold mb-1">Aún no hay publicaciones</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Publica tus productos desde la sección Productos con el botón de publicar,
          y aquí verás su estado en cada canal.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              {["Producto", "Canal", "Estado", "Stock sync", "Precio sync", "Última sync", ""].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {listings.map((l) => (
              <tr key={l.id} className="hover:bg-secondary/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-sm truncate max-w-[240px]">{l.productName}</p>
                  <code className="text-[10px] font-mono text-muted-foreground">{l.sku}</code>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {l.marketplace}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge listing={l} />
                </td>
                <td className="px-4 py-3 text-sm">
                  {l.lastStockSynced ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-sm">
                  {l.lastPriceSynced != null ? (
                    `$${Number(l.lastPriceSynced).toFixed(2)}`
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {l.lastSyncedAt ? new Date(l.lastSyncedAt).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {l.permalink && (
                    <a
                      href={l.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Ver <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-border/50">
        {listings.map((l) => (
          <div key={l.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{l.productName}</p>
                <code className="text-[10px] font-mono text-muted-foreground">{l.sku}</code>
              </div>
              <StatusBadge listing={l} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px] capitalize">
                {l.marketplace}
              </Badge>
              {l.permalink && (
                <a
                  href={l.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary"
                >
                  Ver publicación <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
