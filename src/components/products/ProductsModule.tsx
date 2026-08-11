import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi, Product, ProductsQueryParams } from "@/lib/products-api";
import { ProductsToolbar } from "./ProductsToolbar";
import { ProductsTable } from "./ProductsTable";
import { ProductsPagination } from "./ProductsPagination";
import { ProductFormDialog } from "./ProductFormDialog";
import { DeleteProductDialog } from "./DeleteProductDialog";
import { RegenerateAIDialog } from "./RegenerateAIDialog";
import { PublishProductDialog } from "./PublishProductDialog";
import { toast } from "sonner";

const PAGE_SIZE = 10;

export function ProductsModule() {
  const queryClient = useQueryClient();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState("");
  const [marketplace, setMarketplace] = useState("");
  const [inStock, setInStock]       = useState(false);

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [formOpen, setFormOpen]       = useState(false);
  const [formProduct, setFormProduct] = useState<Product | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [regenTarget, setRegenTarget]   = useState<Product | null>(null);
  const [publishTarget, setPublishTarget] = useState<Product | null>(null);

  // ── Query ─────────────────────────────────────────────────────────────────
  const filters: ProductsQueryParams = {
    page,
    limit: PAGE_SIZE,
    search:      search || undefined,
    marketplace: marketplace || undefined,
    inStock:     inStock || undefined,
    sortBy:      "createdAt",
    order:       "desc",
  };

  const { data: queryResult, isLoading, isError } = useQuery({
    queryKey: ["products", filters],
    queryFn:  () => productsApi.findAll(filters),
    staleTime: 30_000,
  });

  const paginatedData = queryResult?.data;         // PaginatedProducts
  const products      = paginatedData?.data ?? [];
  const totalPages    = paginatedData?.totalPages ?? 1;
  const total         = paginatedData?.total ?? 0;

  // ── Delete mutation ───────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: () => {
      toast.success("Producto eliminado");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDeleteTarget(null);
    },
    onError: () => toast.error("Error al eliminar el producto"),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleMarketplaceChange = (v: string) => { setMarketplace(v); setPage(1); };
  const handleInStockChange = (v: boolean) => { setInStock(v); setPage(1); };

  const openCreate = () => { setFormProduct(undefined); setFormOpen(true); };
  const openEdit   = (p: Product) => { setFormProduct(p); setFormOpen(true); };
  const closeForm  = () => setFormOpen(false);

  const handleFormSuccess = () =>
    queryClient.invalidateQueries({ queryKey: ["products"] });

  const handleRegenSuccess = () =>
    queryClient.invalidateQueries({ queryKey: ["products"] });

  const handleExport = async (format: "csv" | "xlsx" | "json") => {
    try {
      toast.loading("Exportando productos...", { id: "export-toast" });
      await productsApi.exportProducts(format, filters);
      toast.success("Exportación completada", { id: "export-toast" });
    } catch (error: any) {
      toast.error(error.message || "Error al exportar productos", { id: "export-toast" });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <ProductsToolbar
        search={search}
        onSearchChange={handleSearchChange}
        marketplace={marketplace}
        onMarketplaceChange={handleMarketplaceChange}
        inStock={inStock}
        onInStockChange={handleInStockChange}
        onNewProduct={openCreate}
        onExport={handleExport}
      />

      {/* Table */}
      <ProductsTable
        products={products}
        isLoading={isLoading}
        isError={isError}
        onEdit={openEdit}
        onDelete={(p) => setDeleteTarget(p)}
        onRegenerate={(p) => setRegenTarget(p)}
        onPublish={(p) => setPublishTarget(p)}
      />

      {/* Pagination */}
      {!isLoading && !isError && total > 0 && (
        <ProductsPagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
        />
      )}

      {/* Create / Edit dialog */}
      <ProductFormDialog
        open={formOpen}
        product={formProduct}
        onClose={closeForm}
        onSuccess={handleFormSuccess}
      />

      {/* Delete dialog */}
      <DeleteProductDialog
        product={deleteTarget}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Regenerate AI dialog */}
      <RegenerateAIDialog
        product={regenTarget}
        onClose={() => setRegenTarget(null)}
        onSuccess={handleRegenSuccess}
      />

      {/* Publish dialog */}
      <PublishProductDialog
        product={publishTarget}
        onClose={() => setPublishTarget(null)}
      />
    </div>
  );
}
