import { useState, useCallback, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, Sparkles, Loader2, X, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductInputFormProps {
  onSubmit: (data: {
    mode: "single" | "bulk";
    content: string;
    sku: string;
    price?: number;
    images: File[];
  }) => void;
  isProcessing: boolean;
}

export function ProductInputForm({ onSubmit, isProcessing }: ProductInputFormProps) {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [singleProduct, setSingleProduct] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImages = useCallback((newFiles: File[]) => {
    const validFiles = newFiles.filter((f) => f.type.startsWith("image/"));
    if (!validFiles.length) return;

    setImages((prev) => [...prev, ...validFiles]);
    validFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      setPreviews((prev) => [...prev, url]);
    });
  }, []);

  const removeImage = (index: number) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    addImages(files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setBulkFile(file);
  };

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    addImages(files);
    // Reset input so same file can be re-added after removal
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = () => {
    if (mode === "single") {
      onSubmit({
        mode: "single",
        content: singleProduct,
        sku,
        price: price ? parseFloat(price) : undefined,
        images,
      });
    } else if (bulkFile) {
      onSubmit({ mode: "bulk", content: bulkFile.name, sku: "", price: undefined, images: [] });
    }
  };

  const isSingleDisabled = !singleProduct || !sku || images.length === 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h3 className="font-semibold text-base md:text-lg">Información del producto</h3>
        <p className="text-xs md:text-sm text-muted-foreground">
          Ingresa los datos básicos y la IA completará el resto
        </p>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "bulk")}>
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50 h-auto">
          <TabsTrigger value="single" className="gap-1.5 md:gap-2 text-xs md:text-sm py-2 md:py-2.5">
            <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">Producto individual</span>
            <span className="sm:hidden">Individual</span>
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-1.5 md:gap-2 text-xs md:text-sm py-2 md:py-2.5">
            <FileSpreadsheet className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">Carga masiva</span>
            <span className="sm:hidden">Masiva</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-4 md:mt-6 space-y-3 md:space-y-4">
          {/* SKU + Price row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div className="space-y-1.5 md:space-y-2">
              <Label htmlFor="product-sku" className="text-xs md:text-sm">
                SKU <span className="text-destructive">*</span>
              </Label>
              <Input
                id="product-sku"
                placeholder="Ej: APL-IP15PM-256"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="bg-secondary/50 border-border h-10 md:h-12 text-sm"
              />
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <Label htmlFor="product-price" className="text-xs md:text-sm">Precio (opcional)</Label>
              <Input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej: 1299.99"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-secondary/50 border-border h-10 md:h-12 text-sm"
              />
            </div>
          </div>

          {/* Product name */}
          <div className="space-y-1.5 md:space-y-2">
            <Label htmlFor="product-name" className="text-xs md:text-sm">Nombre del producto</Label>
            <Input
              id="product-name"
              placeholder="Ej: iPhone 15 Pro Max 256GB"
              className="bg-secondary/50 border-border h-10 md:h-12 text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5 md:space-y-2">
            <Label htmlFor="product-description" className="text-xs md:text-sm">
              Descripción o información adicional <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="product-description"
              placeholder="Describe el producto, características, especificaciones técnicas, o cualquier información que tengas disponible."
              value={singleProduct}
              onChange={(e) => setSingleProduct(e.target.value)}
              className="min-h-24 md:min-h-32 bg-secondary/50 border-border resize-none text-sm"
            />
          </div>

          {/* Image upload */}
          <div className="space-y-2 md:space-y-3">
            <Label className="text-xs md:text-sm">
              Imágenes del producto <span className="text-destructive">*</span>
            </Label>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-4 md:p-6 text-center transition-all cursor-pointer select-none",
                isDragOver
                  ? "border-primary bg-primary/10 scale-[1.01]"
                  : "border-border hover:border-primary/50 hover:bg-secondary/30"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleImageInputChange}
              />
              <ImagePlus className={cn(
                "w-6 h-6 md:w-8 md:h-8 mx-auto mb-2 transition-colors",
                isDragOver ? "text-primary" : "text-muted-foreground"
              )} />
              <p className="text-xs md:text-sm font-medium">
                {isDragOver ? "Suéltala aquí" : "Arrastra imágenes o haz clic para seleccionar"}
              </p>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                JPG, PNG, WEBP · Múltiples imágenes permitidas
              </p>
            </div>

            {/* Previews grid */}
            {previews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-secondary/50">
                    <img
                      src={src}
                      alt={`Imagen ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:border-destructive hover:text-destructive-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {/* Add more button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-secondary/30 flex flex-col items-center justify-center gap-1 transition-all text-muted-foreground hover:text-primary"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-[9px] md:text-[10px] font-medium">Agregar</span>
                </button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bulk" className="mt-4 md:mt-6 space-y-3 md:space-y-4">
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-6 md:p-12 text-center transition-all cursor-pointer",
              bulkFile
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="bulk-upload"
            />
            <label htmlFor="bulk-upload" className="cursor-pointer">
              <FileSpreadsheet
                className={cn(
                  "w-8 h-8 md:w-12 md:h-12 mx-auto mb-3 md:mb-4",
                  bulkFile ? "text-primary" : "text-muted-foreground"
                )}
              />
              {bulkFile ? (
                <>
                  <p className="font-medium text-primary text-sm md:text-base truncate px-2">{bulkFile.name}</p>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">
                    Archivo listo para procesar
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-sm md:text-base">Sube tu archivo CSV o Excel</p>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">
                    Incluye las columnas: nombre, descripción, SKU, precio
                  </p>
                </>
              )}
            </label>
          </div>

          <div className="flex items-start gap-2 p-3 md:p-4 rounded-xl bg-accent/10 border border-accent/20">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-accent shrink-0 mt-0.5" />
            <p className="text-xs md:text-sm">
              <strong>Pro tip:</strong> Puedes incluir información parcial, la IA
              completará los campos faltantes.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <Button
        onClick={handleSubmit}
        disabled={isProcessing || (mode === "single" && isSingleDisabled) || (mode === "bulk" && !bulkFile)}
        className="w-full h-10 md:h-12 gradient-primary text-primary-foreground font-semibold text-sm md:text-base glow-primary"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 md:w-5 md:h-5 mr-2 animate-spin" />
            Procesando con IA...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 mr-2" />
            Generar con IA
          </>
        )}
      </Button>
    </div>
  );
}
