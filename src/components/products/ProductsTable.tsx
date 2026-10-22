import { Product, ProductOverview } from "@/lib/products-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, FileText, ImageOff, Package, Rocket, Sparkles, Trash2, PackageCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductCard } from "./ProductCard";
import { GroupCard, GroupRows, ProductRow } from "./ProductsRows";

interface ProductsTableProps {
  products: Product[];
  /** Categoría real, estado por canal y completitud de cada producto de la página */
  overview?: Record<string, ProductOverview>;
  overviewLoading?: boolean;
  isLoading: boolean;
  isError: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onRegenerate: (product: Product) => void;
  onPublish: (product: Product) => void;
  onPrepareFalabella: (product: Product) => void;
  onSheet: (product: Product) => void;
}

export function ProductsTable({
  products,
  overview,
  overviewLoading,
  isLoading,
  isError,
  onEdit,
  onDelete,
  onRegenerate,
  onPublish,
  onPrepareFalabella,
  onSheet,
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Datos
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/50">
            {products.map((product) =>
              product.group && product.groupSummary ? (
                <GroupRows key={product.id} product={product} overview={overview} overviewLoading={overviewLoading} onEdit={onEdit} onDelete={onDelete} onRegenerate={onRegenerate} onPublish={onPublish} onPrepareFalabella={onPrepareFalabella} onSheet={onSheet} />
              ) : (
                <ProductRow key={product.id} product={product} overview={overview} overviewLoading={overviewLoading} onEdit={onEdit} onDelete={onDelete} onRegenerate={onRegenerate} onPublish={onPublish} onPrepareFalabella={onPrepareFalabella} onSheet={onSheet} />
              ),
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ───────────────────────────────────────────────────── */}
      <div className="md:hidden divide-y divide-border/50">
        {products.map((product) => product.group && product.groupSummary ? (
          <GroupCard key={product.id} product={product} overview={overview} overviewLoading={overviewLoading} onEdit={onEdit} onDelete={onDelete} onRegenerate={onRegenerate} onPublish={onPublish} onPrepareFalabella={onPrepareFalabella} onSheet={onSheet} />
        ) : (
          <ProductCard
            key={product.id}
            product={product}
            overview={overview?.[product.id]}
            overviewLoading={overviewLoading}
            onEdit={onEdit}
            onDelete={onDelete}
            onRegenerate={onRegenerate}
            onPublish={onPublish}
            onSheet={onSheet}
          />
        ))}
      </div>
    </div>
  );
}
