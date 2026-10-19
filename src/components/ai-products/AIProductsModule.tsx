import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MarketplaceSelector } from "./MarketplaceSelector";
import { ProductInputForm } from "./ProductInputForm";
import { GeneratedFieldsPreview } from "./GeneratedFieldsPreview";
import { ExportActions } from "./ExportActions";
import { PackageReview } from "./PackageReview";
import { LaunchStatus } from "./LaunchStatus";
import { Button } from "@/components/ui/button";
import { syncApi, LaunchReport } from "@/lib/sync-api";
import { Loader2, Sparkles } from "lucide-react";
import { productsApi } from "@/lib/products-api";
import { bulkUploadApi } from "@/lib/bulk-upload-api";
import { toast } from "sonner";
import { useFormDraft } from "@/contexts/FormDraftContext";

interface AIProductsModuleProps {
  /** Dentro de una ventana: sin la tarjeta de bienvenida. */
  compact?: boolean;
  /** Se llama cuando el producto ya se creó y cuando termina el lanzamiento, para refrescar listados. */
  onCreated?: () => void;
}

export function AIProductsModule({ compact = false, onCreated }: AIProductsModuleProps = {}) {
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasGeneratedContent, setHasGeneratedContent] = useState(false);
  const [generatedProduct, setGeneratedProduct] = useState<any>(null);
  const [launch, setLaunch] = useState<LaunchReport | null>(null);
  const [launching, setLaunching] = useState(false);
  // Al cambiar, el formulario se vacía: queda listo para el siguiente producto.
  const [formKey, setFormKey] = useState(0);
  const { setDirty } = useFormDraft();

  // Report dirty state whenever the user configures anything
  useEffect(() => {
    // En la ventana de Nuevo producto no se avisa al cambiar de sección: la ventana se cierra sola.
    if (compact) return;
    const dirty = selectedMarketplaces.length > 0 || selectedCategory !== "";
    setDirty("ai-products", dirty);
  }, [selectedMarketplaces, selectedCategory, setDirty, compact]);
  /** Prepara cada canal (categoría, marca, medidas, atributos, descripción HTML) y publica el producto. */
  const lanzar = async (productId: string) => {
    const canales = selectedMarketplaces.filter((m) => ["mercadolibre", "falabella"].includes(m));
    if (!canales.length) {
      toast.info("WooCommerce, Shopify y otros canales todavía no se publican automáticamente.");
      return;
    }
    setLaunching(true);
    try {
      const res = await syncApi.launchProduct(productId, canales);
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudo publicar");
        return;
      }
      setLaunch(res.data);
      onCreated?.();
      // El servidor eligió categoría, marca y medidas al preparar Falabella: la tarjeta de medidas debe verlos.
      const f = res.data.falabella;
      if (f) {
        setGeneratedProduct((p: any) => ({
          ...p,
          marketplaceIds: { ...(p?.marketplaceIds ?? {}), ...(f.category ? { falabella_category_id: f.category.id } : {}) },
          packageWidth: f.measures.width,
          packageLength: f.measures.length,
          packageHeight: f.measures.height,
          packageWeight: f.measures.weight,
          aiAttributes: { ...(p?.aiAttributes ?? {}), brand: f.brand.value, estimated: { ...(p?.aiAttributes?.estimated ?? {}), measures: f.measures.estimated } },
        }));
      }
      res.data.channels.forEach((c) =>
        c.status === "error" ? toast.error(c.message) : c.status === "omitido" ? toast.info(c.message) : toast.success(c.message),
      );
    } finally {
      setLaunching(false);
    }
  };

  const handleSubmit = async (data: {
    mode: "single" | "bulk";
    content: string;
    sku: string;
    price?: number;
    stock?: number;
    images: File[];
    bulkFile?: File;
  }) => {
    setIsProcessing(true);
    try {
      if (data.mode === "bulk") {
        // ── Carga masiva: envía el Excel al endpoint de bulk-upload ──
        if (!data.bulkFile) {
          toast.error("No se encontró el archivo Excel.");
          return;
        }
        const response = await bulkUploadApi.uploadProducts(data.bulkFile);
        if (response.error) {
          toast.error(response.error);
        } else {
          toast.success(response.data?.message ?? "Productos encolados correctamente");
          console.log("Bulk upload response:", response.data);
        }
      } else {
        // ── Producto individual: genera contenido con IA ──
        const dto = {
          sku: data.sku,
          // Sin texto, la IA arma el nombre y la descripción a partir de las fotos.
          name: data.content.trim() || undefined,
          description: data.content.trim() || undefined,
          category: selectedCategory,
          targetMarketplaces: selectedMarketplaces,
          price: data.price,
          stock: data.stock,
        };
        const response = await productsApi.createWithAIAndFiles(dto, data.images);
        if (response.error) {
          toast.error(response.error);
        } else {
          setHasGeneratedContent(true);
          setGeneratedProduct(response.data);
          setLaunch(null);
          setFormKey((k) => k + 1);
          setDirty("ai-products", false);
          onCreated?.();
          toast.success("Contenido generado. Preparando y publicando en tus canales…");
          // Sin pasos intermedios: se deja listo cada canal y se publica.
          if (response.data?.id) await lanzar(response.data.id);
        }
      }
    } catch (error) {
      toast.error("Error al conectar con el servidor");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async (format: string) => {
    if (!generatedProduct) return;
    try {
      toast.loading(`Exportando en ${format.toUpperCase()}...`, { id: "export-ai-toast" });
      await productsApi.exportAiContent(format as "csv" | "xlsx" | "json", {
        search: generatedProduct.sku // Filtra por el SKU generado
      });
      toast.success("Exportación completada", { id: "export-ai-toast" });
    } catch (error: any) {
      toast.error(error.message || "Error al exportar", { id: "export-ai-toast" });
    }
  };

  /** Reintenta: vuelve a preparar y publicar los canales elegidos. */
  const handlePublish = async () => {
    if (generatedProduct?.id) await lanzar(generatedProduct.id);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
      {/* Hero Section: solo en la página, no dentro de la ventana de Nuevo producto */}
      {!compact && (
        <Card className="p-4 md:p-8 bg-white dark:bg-[#111111] shadow-[0_10px_30px_rgba(0,0,0,0.08)] dark:shadow-none border border-[#EAEAEA] dark:border-white/20 overflow-hidden relative rounded-[20px] transition-colors duration-200">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#FCCB34] opacity-5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
  
          <div className="relative flex flex-col sm:flex-row items-start gap-4 md:gap-6">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-[#FCCB34] shadow-[0_8px_16px_rgba(252,203,52,0.3)] flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-[#111111]" />
            </div>
  
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-[#111111] dark:text-[#F8F8F5]">Optimiza tus productos con IA</h2>
              <p className="text-sm md:text-base text-[#666666] dark:text-[#A1A1AA] mt-2 max-w-xl leading-relaxed">
                Ingresa información básica de tus productos y nuestra IA generará
                automáticamente títulos optimizados, descripciones atractivas y
                todos los campos necesarios para cada marketplace.
              </p>
  
              <div className="flex flex-wrap gap-2 md:gap-3 mt-4">
                <span className="text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-[#FFF1B8] dark:bg-[#FCCB34]/20 text-[#111111] dark:text-[#FCCB34] font-semibold border border-[#FCCB34]/30 dark:border-[#FCCB34]/20 shadow-sm">
                  ✨ Títulos SEO optimizados
                </span>
                <span className="text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-[#F8F8F5] dark:bg-[#1A1A1A] text-[#111111] dark:text-[#F8F8F5] font-medium border border-[#EAEAEA] dark:border-white/20 shadow-sm">
                  📝 Descripciones que venden
                </span>
                <span className="text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-white dark:bg-[#222222] text-[#111111] dark:text-[#F8F8F5] font-medium border border-[#EAEAEA] dark:border-white/20 shadow-sm">
                  🏷️ Atributos automáticos
                </span>
              </div>
            </div>
          </div>
        </Card>
  
      )}

      {/* Step 1: Marketplaces */}
      <Card className="p-4 md:p-6 bg-white dark:bg-[#111111] shadow-sm border border-[#EAEAEA] dark:border-white/20 rounded-[16px] transition-colors duration-200">
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#FCCB34] text-[#111111] text-xs md:text-sm font-bold flex items-center justify-center shadow-sm">
            1
          </span>
          <span className="font-semibold text-[#111111] dark:text-[#F8F8F5] text-sm md:text-base tracking-tight">Selecciona los canales destino</span>
        </div>
        <MarketplaceSelector
          selected={selectedMarketplaces}
          onChange={setSelectedMarketplaces}
        />
      </Card>

      {/* Step 2: Product Input */}
      <Card className="p-4 md:p-6 bg-white dark:bg-[#111111] shadow-sm border border-[#EAEAEA] dark:border-white/20 rounded-[16px] transition-colors duration-200">
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#FCCB34] text-[#111111] text-xs md:text-sm font-bold flex items-center justify-center shadow-sm">
            2
          </span>
          <span className="font-semibold text-[#111111] dark:text-[#F8F8F5] text-sm md:text-base tracking-tight">Ingresa la información del producto</span>
        </div>
        <ProductInputForm
          key={formKey}
          onSubmit={handleSubmit}
          isProcessing={isProcessing}
          isFormReady={selectedMarketplaces.length > 0}
        />
      </Card>

      {/* Step 3: Generated Fields Preview */}
      {hasGeneratedContent && (
        <Card className="p-4 md:p-6 bg-white dark:bg-[#111111] shadow-sm border border-[#EAEAEA] dark:border-white/20 rounded-[16px] transition-colors duration-200">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#111111] dark:bg-[#FCCB34] text-white dark:text-[#111111] text-xs md:text-sm font-bold flex items-center justify-center shadow-sm">
              3
            </span>
            <span className="font-semibold text-[#111111] dark:text-[#F8F8F5] text-sm md:text-base tracking-tight">Revisa los resultados</span>
          </div>
          <GeneratedFieldsPreview visible={hasGeneratedContent} productData={generatedProduct} />

          {selectedMarketplaces.includes("falabella") && generatedProduct && (
            <div className="mt-4">
              <PackageReview
                product={generatedProduct}
                onReviewed={(m) =>
                  setGeneratedProduct((p: any) => ({
                    ...p,
                    ...m,
                    aiAttributes: { ...(p.aiAttributes ?? {}), estimated: { ...(p.aiAttributes?.estimated ?? {}), measures: false } },
                  }))
                }
              />
            </div>
          )}

          {launching && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> La IA está preparando cada canal y publicando…
            </div>
          )}

          {launch && (
            <div className="mt-4 rounded-xl border border-border p-3 md:p-4 space-y-2">
              <p className="text-sm font-medium">Resultado de la publicación</p>
              {launch.channels.map((c) => (
                <p key={c.marketplace} className={`text-sm break-words ${c.status === "error" ? "text-red-400" : c.status === "omitido" ? "text-amber-500" : "text-green-500"}`}>
                  {c.status === "encolado" ? "✓" : c.status === "omitido" ? "•" : "✗"} {c.message}
                </p>
              ))}
              {launch.falabella && (
                <p className="text-xs text-muted-foreground break-words">
                  Falabella: {launch.falabella.category ? launch.falabella.category.path : "sin categoría"} · marca {launch.falabella.brand.value}
                  {launch.falabella.attributes ? ` · atributos ${launch.falabella.attributes.filled} de ${launch.falabella.attributes.total}` : ""}
                  {launch.falabella.listo ? "" : ` · todavía ${launch.falabella.motivo}`}
                </p>
              )}
              {launch.estimatedMeli.length > 0 && (
                <p className="text-xs text-amber-500 break-words">Mercado Libre: la IA estimó estos datos obligatorios, revísalos en la ficha: {launch.estimatedMeli.join(", ")}.</p>
              )}
              {generatedProduct?.id && <LaunchStatus productId={generatedProduct.id} />}
              <p className="text-[11px] text-muted-foreground">
                Lo que la IA estimó (medidas, algunos atributos) queda marcado para revisarlo. Puedes corregirlo desde la <b>Ficha</b> del producto y se envía solo a los canales.
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                setHasGeneratedContent(false);
                setGeneratedProduct(null);
                setLaunch(null);
                setFormKey((k) => k + 1);
              }}
            >
              Crear otro producto
            </Button>
            <span className="text-xs text-muted-foreground">El formulario ya está vacío. Este producto sigue en proceso y lo ves en Productos o Marketplaces.</span>
          </div>

          <Separator className="my-6 md:my-8" />

          <ExportActions
            visible={hasGeneratedContent}
            selectedMarketplaces={selectedMarketplaces}
            onExport={handleExport}
            onPublish={handlePublish}
          />
        </Card>
      )}
    </div>
  );
}
