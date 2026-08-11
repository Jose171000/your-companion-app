import { Product } from "@/lib/products-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Sparkles, ImageOff, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onRegenerate: (product: Product) => void;
  onPublish: (product: Product) => void;
}

export function ProductCard({ product, onEdit, onDelete, onRegenerate, onPublish }: ProductCardProps) {
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

          {/* Actions */}
          <div className="flex gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => onPublish(product)}
              title="Publicar en marketplaces"
            >
              <Rocket className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-accent"
              onClick={() => onRegenerate(product)}
              title="Regenerar con IA"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => onEdit(product)}
              title="Editar"
            >
              <Edit className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(product)}
              title="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
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

        {/* Marketplace badges */}
        {marketplaces.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {marketplaces.slice(0, 3).map((mp) => (
              <Badge key={mp} variant="secondary" className="text-[10px] py-0 px-1.5 capitalize">
                {mp}
              </Badge>
            ))}
            {marketplaces.length > 3 && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                +{marketplaces.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
