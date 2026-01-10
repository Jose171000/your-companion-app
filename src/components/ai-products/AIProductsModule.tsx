import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MarketplaceSelector } from "./MarketplaceSelector";
import { CategorySelector } from "./CategorySelector";
import { ProductInputForm } from "./ProductInputForm";
import { GeneratedFieldsPreview } from "./GeneratedFieldsPreview";
import { ExportActions } from "./ExportActions";
import { Sparkles } from "lucide-react";

export function AIProductsModule() {
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasGeneratedContent, setHasGeneratedContent] = useState(false);

  const handleSubmit = async (data: { mode: "single" | "bulk"; content: string }) => {
    setIsProcessing(true);
    // Simular procesamiento de IA
    await new Promise((resolve) => setTimeout(resolve, 2500));
    setIsProcessing(false);
    setHasGeneratedContent(true);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
      {/* Hero Section */}
      <Card className="p-4 md:p-8 glass overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 gradient-primary opacity-10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex flex-col sm:flex-row items-start gap-4 md:gap-6">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl gradient-primary flex items-center justify-center glow-primary shrink-0">
            <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-primary-foreground" />
          </div>
          
          <div>
            <h2 className="text-xl md:text-2xl font-bold">Optimiza tus productos con IA</h2>
            <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-xl">
              Ingresa información básica de tus productos y nuestra IA generará 
              automáticamente títulos optimizados, descripciones atractivas y 
              todos los campos necesarios para cada marketplace.
            </p>
            
            <div className="flex flex-wrap gap-2 md:gap-3 mt-4">
              <span className="text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-primary/10 text-primary font-medium">
                ✨ Títulos SEO optimizados
              </span>
              <span className="text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-accent/10 text-accent font-medium">
                📝 Descripciones que venden
              </span>
              <span className="text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-secondary text-secondary-foreground font-medium">
                🏷️ Atributos automáticos
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Step 1: Marketplaces */}
      <Card className="p-4 md:p-6 glass">
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <span className="w-7 h-7 md:w-8 md:h-8 rounded-full gradient-primary text-xs md:text-sm font-bold text-primary-foreground flex items-center justify-center">
            1
          </span>
          <span className="font-semibold text-sm md:text-base">Selecciona los canales</span>
        </div>
        <MarketplaceSelector 
          selected={selectedMarketplaces} 
          onChange={setSelectedMarketplaces} 
        />
      </Card>

      {/* Step 2: Category */}
      <Card className="p-4 md:p-6 glass">
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <span className="w-7 h-7 md:w-8 md:h-8 rounded-full gradient-primary text-xs md:text-sm font-bold text-primary-foreground flex items-center justify-center">
            2
          </span>
          <span className="font-semibold text-sm md:text-base">Elige la categoría</span>
        </div>
        <CategorySelector 
          value={selectedCategory} 
          onChange={setSelectedCategory} 
        />
      </Card>

      {/* Step 3: Product Input */}
      <Card className="p-4 md:p-6 glass">
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <span className="w-7 h-7 md:w-8 md:h-8 rounded-full gradient-primary text-xs md:text-sm font-bold text-primary-foreground flex items-center justify-center">
            3
          </span>
          <span className="font-semibold text-sm md:text-base">Ingresa la información</span>
        </div>
        <ProductInputForm 
          onSubmit={handleSubmit} 
          isProcessing={isProcessing} 
        />
      </Card>

      {/* Step 4: Generated Fields Preview */}
      {hasGeneratedContent && (
        <Card className="p-4 md:p-6 glass">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <span className="w-7 h-7 md:w-8 md:h-8 rounded-full gradient-accent text-xs md:text-sm font-bold text-accent-foreground flex items-center justify-center">
              4
            </span>
            <span className="font-semibold text-sm md:text-base">Revisa los resultados</span>
          </div>
          <GeneratedFieldsPreview visible={hasGeneratedContent} />
          
          <Separator className="my-6 md:my-8" />
          
          <ExportActions 
            visible={hasGeneratedContent} 
            selectedMarketplaces={selectedMarketplaces} 
          />
        </Card>
      )}
    </div>
  );
}
