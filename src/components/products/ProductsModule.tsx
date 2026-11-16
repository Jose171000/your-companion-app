import { useEffect, useState } from "react";
import { useStores } from "@/contexts/StoreContext";
import { useDestinoPendiente } from "@/lib/aviso-destino";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi, Product, ProductsQueryParams } from "@/lib/products-api";
import { syncApi } from "@/lib/sync-api";
import { ProductsToolbar } from "./ProductsToolbar";
import { ProductsTable } from "./ProductsTable";
import { ProductsPagination } from "./ProductsPagination";
import { EstadoFiltro, ProductsSummaryBar } from "./ProductsSummaryBar";
import { ProductFormDialog } from "./ProductFormDialog";
import { NewProductDialog } from "./NewProductDialog";
import { DeleteProductDialog } from "./DeleteProductDialog";
import { RegenerateAIDialog } from "./RegenerateAIDialog";
import { PublishProductDialog } from "./PublishProductDialog";
import { ProductSheetDialog } from "./ProductSheetDialog";
import { PrepareFalabellaDialog } from "./PrepareFalabellaDialog";
import { PrepareRipleyDialog } from "./PrepareRipleyDialog";
import { DescuentoGeneralDialog } from "@/components/marketplaces/DescuentoGeneralDialog";
import { MAX_REGENERACION, RegeneracionMasivaDialog } from "./RegeneracionMasivaDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

const TAMANOS_DE_PAGINA = [10, 25, 50, 100];

export function ProductsModule() {
  const queryClient = useQueryClient();
  const { activeStore, can } = useStores();
  const storeId = activeStore?.id ?? "";

  // ── Filter state ──────────────────────────────────────────────────────────
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(10);
  const [search, setSearch]         = useState("");
  const [marketplace, setMarketplace] = useState("");
  const [inStock, setInStock]       = useState(false);
  const [estado, setEstado]         = useState<EstadoFiltro>("");

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [formOpen, setFormOpen]       = useState(false);
  const [formProduct, setFormProduct] = useState<Product | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [regenTarget, setRegenTarget]   = useState<Product | null>(null);
  const [publishTarget, setPublishTarget] = useState<Product | null>(null);
  const [sheetTarget, setSheetTarget] = useState<Product | null>(null);
  // La ficha se oculta (sin cerrarse) mientras se abre Preparar o Publicar desde ella; al cerrarlos vuelve tal como estaba.
  const [sheetOculta, setSheetOculta] = useState(false);
  const volverALaFicha = () => {
    if (!sheetOculta) return;
    setSheetOculta(false);
    queryClient.invalidateQueries({ queryKey: ["product-sheet"] });
  };

  // Clic en un aviso de la campana: abre la ficha del producto.
  useDestinoPendiente("products", async ({ productId }) => {
    const res = await productsApi.findOne(productId);
    if (res.error || !res.data) toast.error("No se encontró ese producto: quizá ya no existe o no tienes acceso.");
    else setSheetTarget(res.data);
  });
  const [falabellaTarget, setFalabellaTarget] = useState<Product | null>(null);
  const [ripleyTarget, setRipleyTarget] = useState<Product | null>(null);
  const [descuentoOpen, setDescuentoOpen] = useState(false);
  // Selección para acciones en lote: por id de la fila (un grupo de variantes cuenta como una fila). Se conserva al cambiar de página.
  const [seleccionados, setSeleccionados] = useState<Map<string, Product>>(new Map());
  const [regenOpen, setRegenOpen] = useState(false);
  const [loteActivo, setLoteActivo] = useState<string | null>(null);
  const alternarSeleccion = (p: Product) =>
    setSeleccionados((prev) => {
      const n = new Map(prev);
      if (n.has(p.id)) n.delete(p.id);
      else if (n.size >= MAX_REGENERACION) toast.warning(`Máximo ${MAX_REGENERACION} productos por tanda.`);
      else n.set(p.id, p);
      return n;
    });

  // ── Query ─────────────────────────────────────────────────────────────────
  const filters: ProductsQueryParams = {
    page,
    limit: pageSize,
    search:      search || undefined,
    marketplace: marketplace || undefined,
    inStock:     inStock || undefined,
    estado:      estado || undefined,
    sortBy:      "createdAt",
    order:       "desc",
  };

  const { data: queryResult, isLoading, isError } = useQuery({
    queryKey: ["products", storeId, filters],
    queryFn:  () => productsApi.findAll(filters),
    staleTime: 30_000,
  });

  const paginatedData = queryResult?.data;         // PaginatedProducts
  const products      = paginatedData?.data ?? [];
  // La paginación viene en `meta`; sin leerla, la lista parecía tener una sola página y no se mostraban los controles.
  const totalPages    = paginatedData?.meta?.totalPages ?? paginatedData?.totalPages ?? 1;
  const total         = paginatedData?.meta?.total ?? paginatedData?.total ?? products.length;

  // Lo que no viene en la lista: categoría real, estado de cada canal y qué falta (una consulta por página).
  // Un grupo de variantes es una fila, pero su estado se calcula con todas sus variantes.
  const ids = [...new Set(products.flatMap((p) => [p.id, ...(p.groupSummary?.variantIds ?? [])]))];
  // Para el descuento: un grupo cuenta con todas sus variantes (cada una es un producto con su precio).
  // El descuento va a lo seleccionado; si no hay selección, a lo que se ve en la lista (con su búsqueda o filtro).
  const filasDelDescuento = seleccionados.size > 0 ? [...seleccionados.values()] : products;
  const idsDelDescuento = [...new Set(filasDelDescuento.flatMap((p) => (p.groupSummary?.variantIds?.length ? p.groupSummary.variantIds : [p.id])))];
  const resumenDelDescuento = seleccionados.size > 0
    ? `${seleccionados.size} producto(s) seleccionado(s)${idsDelDescuento.length !== seleccionados.size ? ` (${idsDelDescuento.length} con sus variantes)` : ""}`
    : `Ningún producto seleccionado: se aplicará a los ${products.length} de esta página${idsDelDescuento.length !== products.length ? ` (${idsDelDescuento.length} con sus variantes)` : ""}${search ? ` · búsqueda «${search}»` : ""}`;
  const { data: overviewResult, isLoading: overviewLoading } = useQuery({
    queryKey: ["products-overview", storeId, ids],
    queryFn: () => productsApi.overview(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
  const { data: summaryResult } = useQuery({
    queryKey: ["products-summary", storeId],
    queryFn: () => productsApi.summary(),
    staleTime: 30_000,
  });

  // Al cambiar de tienda se empieza desde la primera página, sin filtros de la anterior.
  useEffect(() => {
    setPage(1);
    setEstado("");
    setSearch("");
    setMarketplace("");
    setSeleccionados(new Map());
    setLoteActivo(null);
  }, [storeId]);

  // ── Delete mutation ───────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    // apiRequest no lanza en un error del servidor: lo devuelve; sin esto se avisaba «eliminado» aunque no se hubiera borrado.
    mutationFn: async (p: Product) => {
      // Desde la fila de un grupo se eliminan todas sus variantes.
      const ids = p.alGrupo ? (p.groupSummary?.variantIds ?? [p.id]) : [p.id];
      for (const id of ids) {
        const res = await productsApi.remove(id);
        if (res.error) throw new Error(res.error);
      }
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(n > 1 ? `Producto eliminado con sus ${n} variantes` : "Producto eliminado");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDeleteTarget(null);
    },
    onError: (error: Error) => toast.error(error.message || "Error al eliminar el producto"),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleMarketplaceChange = (v: string) => { setMarketplace(v); setPage(1); };
  const handlePageSizeChange = (n: number) => { setPageSize(n); setPage(1); };
  const handleInStockChange = (v: boolean) => { setInStock(v); setPage(1); };
  const handleEstadoChange = (v: EstadoFiltro) => { setEstado(v); setPage(1); };

  // Reenviar las fotos a Falabella: solo desde el filtro «Falta imagen en Falabella», que lista únicamente lo que Falabella rechazó por sus imágenes.
  const [reenviandoFotos, setReenviandoFotos] = useState(false);
  const reenviarFotos = async () => {
    const filas = seleccionados.size > 0 ? [...seleccionados.values()] : products;
    const idsFotos = [...new Set(filas.flatMap((p) => (p.groupSummary?.variantIds?.length ? p.groupSummary.variantIds : [p.id])))];
    if (!window.confirm(`Se volverán a mandar a Falabella las fotos de ${idsFotos.length} producto(s) a los que les falta la imagen. ¿Continuar?`)) return;
    setReenviandoFotos(true);
    try {
      const res = await syncApi.resendFalabellaImages(idsFotos);
      if (res.error || !res.data) { toast.error(res.error ?? "No se pudieron reenviar las imágenes"); return; }
      // Por qué se omitieron, agrupado: sin fotos, enviadas hace poco, tope de intentos…
      const motivos = new Map<string, number>();
      for (const o of res.data.omitidos) motivos.set(o.motivo, (motivos.get(o.motivo) ?? 0) + 1);
      const detalle = [...motivos.entries()].map(([m, n]) => `${n}: ${m}`).join(" · ");
      toast.success(`Fotos reenviadas a Falabella: ${res.data.enviados}.${res.data.omitidos.length ? ` Omitidos ${res.data.omitidos.length} — ${detalle}.` : ""} Falabella tarda unos minutos en procesarlas; no hace falta reenviar a cada momento.`, { duration: 12000 });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch {
      toast.error("Error al conectar con el servidor");
    } finally {
      setReenviandoFotos(false);
    }
  };

  // «Nuevo producto» usa el mismo flujo de IA Productos; la ventana de edición se queda para cambiar un producto existente.
  const [newOpen, setNewOpen] = useState(false);
  const openCreate = () => setNewOpen(true);
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
        onDescuento={products.length > 0 ? () => setDescuentoOpen(true) : undefined}
      />

      <ProductsSummaryBar summary={summaryResult?.data} value={estado} onChange={handleEstadoChange} />

      {/* Solo en el filtro «Falta imagen en Falabella»: ahí están únicamente los que Falabella rechazó por sus imágenes. */}
      {estado === "falta-imagen" && can("canales.publicar") && products.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
          <p className="flex-1 min-w-[16rem] text-muted-foreground">Falabella rechazó estas fichas por falta de imágenes. Si tienen fotos en Synkro, se las vuelvo a mandar{seleccionados.size > 0 ? ` (solo las ${seleccionados.size} seleccionadas)` : " (todas las de esta página)"}. Las que no tienen fotos en Synkro se omiten: cárgales imágenes primero (filtro «Sin fotos»).</p>
          <Button size="sm" className="gradient-primary" disabled={reenviandoFotos} onClick={reenviarFotos}>
            {reenviandoFotos ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5 mr-1.5" />} Reenviar imágenes a Falabella
          </Button>
        </div>
      )}

      {/* Selección para generar con IA varios productos a la vez */}
      {can("productos.editar") && products.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={products.every((p) => seleccionados.has(p.id))}
              onCheckedChange={(v) =>
                setSeleccionados((prev) => {
                  const n = new Map(prev);
                  if (v) { for (const p of products) { if (n.size < MAX_REGENERACION) n.set(p.id, p); } }
                  else for (const p of products) n.delete(p.id);
                  return n;
                })
              }
              aria-label="Seleccionar los productos de esta página"
            />
            <span className="text-muted-foreground">Seleccionar esta página</span>
          </label>
          {(seleccionados.size > 0 || loteActivo) && (
            <>
              <span className="text-muted-foreground">{seleccionados.size} seleccionado(s) (máx. {MAX_REGENERACION})</span>
              <Button size="sm" className="gradient-primary" onClick={() => setRegenOpen(true)}>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> {loteActivo ? "Ver avance de la IA" : `Generar con IA (${seleccionados.size})`}
              </Button>
              {seleccionados.size > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setSeleccionados(new Map())}><X className="w-3.5 h-3.5 mr-1" /> Quitar selección</Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Table */}
      <ProductsTable
        products={products}
        overview={overviewResult?.data}
        overviewLoading={overviewLoading}
        isLoading={isLoading}
        isError={isError}
        seleccion={can("productos.editar") ? { ids: new Set(seleccionados.keys()), alternar: alternarSeleccion } : undefined}
        onEdit={openEdit}
        onDelete={(p) => setDeleteTarget(p)}
        onRegenerate={(p) => setRegenTarget(p)}
        onPublish={(p) => setPublishTarget(p)}
        onPrepareFalabella={(p) => setFalabellaTarget(p)}
        onPrepareRipley={(p) => setRipleyTarget(p)}
        onSheet={(p) => setSheetTarget(p)}
      />

      {/* Pagination */}
      {!isLoading && !isError && total > 0 && (
        <ProductsPagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
          pageSize={pageSize}
          pageSizes={TAMANOS_DE_PAGINA}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      <NewProductDialog open={newOpen} onClose={() => setNewOpen(false)} />

      <RegeneracionMasivaDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        productIds={[...seleccionados.keys()]}
        loteInicialId={loteActivo}
        onLote={setLoteActivo}
      />

      {/* Descuento general: los productos seleccionados; sin selección, los de la lista que se ve ahora */}
      <DescuentoGeneralDialog
        open={descuentoOpen}
        onOpenChange={setDescuentoOpen}
        productIds={idsDelDescuento}
        resumen={resumenDelDescuento}
        precioEjemplo={filasDelDescuento.length === 1 ? Number(filasDelDescuento[0].price) || null : null}
      />

      {/* Edit dialog */}
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
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Regenerate AI dialog */}
      <RegenerateAIDialog
        product={regenTarget}
        onClose={() => setRegenTarget(null)}
        onSuccess={handleRegenSuccess}
      />

      {/* Publish dialog */}
      <PrepareFalabellaDialog
        product={falabellaTarget}
        open={falabellaTarget !== null}
        desdeFicha={sheetOculta}
        onClose={() => { setFalabellaTarget(null); volverALaFicha(); }}
      />

      <PrepareRipleyDialog
        product={ripleyTarget}
        open={ripleyTarget !== null}
        desdeFicha={sheetOculta}
        onClose={() => { setRipleyTarget(null); volverALaFicha(); }}
      />

      <PublishProductDialog
        product={publishTarget}
        desdeFicha={sheetOculta}
        onClose={() => { setPublishTarget(null); volverALaFicha(); }}
      />

      <ProductSheetDialog
        product={sheetTarget}
        onClose={() => { setSheetTarget(null); setSheetOculta(false); }}
        oculta={sheetOculta}
        onOcultar={() => setSheetOculta(true)}
        onPublish={(p) => setPublishTarget(p)}
        onPrepareFalabella={(p) => setFalabellaTarget(p)}
        onPrepareRipley={(p) => setRipleyTarget(p)}
      />
    </div>
  );
}
