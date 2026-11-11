import { Product, ProductOverview } from "@/lib/products-api";
import { CategoryCell, ChannelsCell, CompletenessCell } from "./ProductStatusCells";
import { Button } from "@/components/ui/button";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccionesDeFila } from "./AccionesDeFila";

interface ProductCardProps {
  product: Product;
  overview?: ProductOverview;
  overviewLoading?: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onRegenerate: (product: Product) => void;
  onPublish?: (product: Product) => void;
  onSheet?: (product: Product) => void;
}

export function ProductCard({ product, overview, overviewLoading, onEdit, onDelete, onRegenerate, onSheet }: ProductCardProps) {
  const marketplaces = product.targetMarketplaces ?? [];

  return (
    <div className="p-4 flex gap-3 hover:bg-secondary/20 transition-colors">
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-secondary/50 flex items-center justify-center shrink-0 border border-border">
        {product.images?.[0] ? (
          <img
            src={product.images[0].url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageOff className="w-5 h-5 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate leading-tight">{product.name}</p>
            <code className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded mt-1 inline-block">
              {product.sku}
            </code>
          </div>

        </div>

        {/* Price + Stock */}
        <div className="flex items-center gap-3 mt-1.5">
          {product.price != null && (
            <span className="text-sm font-bold text-primary">
              ${Number(product.price).toFixed(2)}
            </span>
          )}
          {product.stock != null && (
            <span
              className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded",
                Number(product.stock) > 0
                  ? "bg-green-500/10 text-green-400"
                  : "bg-red-500/10 text-red-400"
              )}
            >
              {Number(product.stock) > 0 ? `${product.stock} uds.` : "Sin stock"}
            </span>
          )}
        </div>

        {/* Categoría, canales y datos reales */}
        <div className="mt-2 space-y-1.5">
          <CategoryCell overview={overview} loading={overviewLoading} />
          <ChannelsCell overview={overview} intended={marketplaces} loading={overviewLoading} />
          <CompletenessCell overview={overview} loading={overviewLoading} />
        </div>

        {/* Una sola acción a la vista, igual que en el escritorio */}
        {onSheet && <div className="mt-3"><AccionesDeFila producto={product} onSheet={onSheet} onRegenerate={onRegenerate} onEdit={onEdit} onDelete={onDelete} /></div>}
      </div>
    </div>
  );
}
