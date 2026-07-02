import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MarketplaceSelector } from "./MarketplaceSelector";
import { CategorySelector } from "./CategorySelector";
import { ProductInputForm } from "./ProductInputForm";
import { GeneratedFieldsPreview } from "./GeneratedFieldsPreview";
import { ExportActions } from "./ExportActions";
import { Sparkles } from "lucide-react";
import { productsApi } from "@/lib/products-api";
import { bulkUploadApi } from "@/lib/bulk-upload-api";
import { toast } from "sonner";
import { useFormDraft } from "@/contexts/FormDraftContext";

export function AIProductsModule() {
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasGeneratedContent, setHasGeneratedContent] = useState(false);
  const [generatedProduct, setGeneratedProduct] = useState<any>(null);
  const { setDirty } = useFormDraft();

  // Report dirty state whenever the user configures anything
  useEffect(() => {
    const dirty = selectedMarketplaces.length > 0 || selectedCategory !== "";
    setDirty("ai-products", dirty);
  }, [selectedMarketplaces, selectedCategory, setDirty]);
  const handleSubmit = async (data: {
    mode: "single" | "bulk";
    content: string;
    sku: string;
    price?: number;
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
          name: data.content,
          description: data.content,
          category: selectedCategory,
          targetMarketplaces: selectedMarketplaces,
          price: data.price,
        };
        const response = await productsApi.createWithAIAndFiles(dto, data.images);
        if (response.error) {
          toast.error(response.error);
        } else {
          setHasGeneratedContent(true);
          setGeneratedProduct(response.data);
          setDirty("ai-products", false);
          toast.success("Contenido generado exitosamente");
          console.log("Generated Content:", response.data);
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

  const handlePublish = async () => {
    toast.success("Publicación iniciada (simulación)");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
      {/* Hero Section */}
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

      {/* Step 2: Category */}
      <Card className="p-4 md:p-6 bg-white dark:bg-[#111111] shadow-sm border border-[#EAEAEA] dark:border-white/20 rounded-[16px] transition-colors duration-200">
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#FCCB34] text-[#111111] text-xs md:text-sm font-bold flex items-center justify-center shadow-sm">
            2
          </span>
          <span className="font-semibold text-[#111111] dark:text-[#F8F8F5] text-sm md:text-base tracking-tight">Elige la categoría principal</span>
        </div>
        <CategorySelector
          value={selectedCategory}
          onChange={setSelectedCategory}
        />
      </Card>

      {/* Step 3: Product Input */}
      <Card className="p-4 md:p-6 bg-white dark:bg-[#111111] shadow-sm border border-[#EAEAEA] dark:border-white/20 rounded-[16px] transition-colors duration-200">
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#FCCB34] text-[#111111] text-xs md:text-sm font-bold flex items-center justify-center shadow-sm">
            3
          </span>
          <span className="font-semibold text-[#111111] dark:text-[#F8F8F5] text-sm md:text-base tracking-tight">Ingresa la información del producto</span>
        </div>
        <ProductInputForm
          onSubmit={handleSubmit}
          isProcessing={isProcessing}
          isFormReady={selectedMarketplaces.length > 0 && selectedCategory !== ""}
        />
      </Card>

      {/* Step 4: Generated Fields Preview */}
      {hasGeneratedContent && (
        <Card className="p-4 md:p-6 bg-white dark:bg-[#111111] shadow-sm border border-[#EAEAEA] dark:border-white/20 rounded-[16px] transition-colors duration-200">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#111111] dark:bg-[#FCCB34] text-white dark:text-[#111111] text-xs md:text-sm font-bold flex items-center justify-center shadow-sm">
              4
            </span>
            <span className="font-semibold text-[#111111] dark:text-[#F8F8F5] text-sm md:text-base tracking-tight">Revisa los resultados</span>
          </div>
          <GeneratedFieldsPreview visible={hasGeneratedContent} productData={generatedProduct} />

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
