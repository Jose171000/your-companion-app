import { Product } from "@/lib/products-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, ImageOff, Package, Rocket, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductCard } from "./ProductCard";

interface ProductsTableProps {
  products: Product[];
  isLoading: boolean;
  isError: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onRegenerate: (product: Product) => void;
  onPublish: (product: Product) => void;
}

export function ProductsTable({
  products,
  isLoading,
  isError,
  onEdit,
  onDelete,
  onRegenerate,
  onPublish,
}: ProductsTableProps) {
  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="glass rounded-2xl overflow-hidden divide-y divide-border/50">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-16 hidden md:block" />
            <Skeleton className="h-4 w-12 hidden md:block" />
            <Skeleton className="h-4 w-20 hidden md:block" />
            <Skeleton className="h-8 w-24 hidden md:block rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="glass rounded-2xl flex flex-col items-center justify-center py-20 text-center">
        <Package className="w-14 h-14 text-muted-foreground mb-4 opacity-40" />
        <p className="font-semibold text-muted-foreground">Error al cargar los productos</p>
        <p className="text-xs text-muted-foreground mt-1">
          Revisa tu conexión o vuelve a intentarlo
        </p>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!products.length) {
    return (
      <div className="glass rounded-2xl flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 rounded-2xl bg-secondary/50 flex items-center justify-center mb-6">
          <Package className="w-10 h-10 text-muted-foreground opacity-50" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No hay productos</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Crea tu primer producto o ajusta los filtros de búsqueda para encontrar lo que buscas.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* ── Desktop table ──────────────────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Producto
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                SKU
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Categoría
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Precio
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Stock
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Canales
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/50">
            {products.map((product) => {
              const marketplaces = product.targetMarketplaces ?? [];
              return (
                <tr
                  key={product.id}
                  className="hover:bg-secondary/20 transition-colors group"
                >
                  {/* Product */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary/50 border border-border flex items-center justify-center shrink-0">
                        {product.images?.[0] ? (
                          <img
                            src={product.images[0].url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageOff className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium text-sm truncate max-w-[200px]">
                        {product.name}
                      </span>
                    </div>
                  </td>

                  {/* SKU */}
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono bg-secondary/70 text-muted-foreground px-2 py-1 rounded">
                      {product.sku}
                    </code>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {product.category ? (
                        <>
                          {product.category}
                          {product.subCategory && (
                            <span className="text-muted-foreground/60">
                              {" / "}{product.subCategory}
                            </span>
                          )}
                        </>
                      ) : "—"}
                    </span>
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold">
                      {product.price != null
                        ? `$${Number(product.price).toFixed(2)}`
                        : <span className="text-muted-foreground font-normal">—</span>}
                    </span>
                  </td>

                  {/* Stock */}
                  <td className="px-4 py-3">
                    {product.stock != null ? (
                      <span
                        className={cn(
                          "text-xs font-semibold px-2 py-1 rounded",
                          Number(product.stock) > 0
                            ? "bg-green-500/10 text-green-400"
                            : "bg-red-500/10 text-red-400"
                        )}
                      >
                        {Number(product.stock) > 0 ? product.stock : "Sin stock"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </td>

                  {/* Marketplaces */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {marketplaces.slice(0, 2).map((mp) => (
                        <Badge
                          key={mp}
                          variant="secondary"
                          className="text-[10px] py-0 px-1.5 capitalize"
                        >
                          {mp}
                        </Badge>
                      ))}
                      {marketplaces.length > 2 && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                          +{marketplaces.length - 2}
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-primary hover:bg-primary/10"
                        onClick={() => onPublish(product)}
                        title="Publicar en marketplaces"
                      >
                        <Rocket className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-accent hover:bg-accent/10"
                        onClick={() => onRegenerate(product)}
                        title="Regenerar con IA"
                      >
                        <Sparkles className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-primary hover:bg-primary/10"
                        onClick={() => onEdit(product)}
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(product)}
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ───────────────────────────────────────────────────── */}
      <div className="md:hidden divide-y divide-border/50">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onEdit={onEdit}
            onDelete={onDelete}
            onRegenerate={onRegenerate}
            onPublish={onPublish}
          />
        ))}
      </div>
    </div>
  );
}
