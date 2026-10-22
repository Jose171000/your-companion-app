import { useState, useCallback, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, Sparkles, Loader2, X, ImagePlus, Download, FileArchive } from "lucide-react";
import { bulkUploadApi } from "@/lib/bulk-upload-api";
import { useStores } from "@/contexts/StoreContext";
import { VariantsWizard, type ResultadoDelRecorrido } from "./VariantsWizard";
import { variantsApi, type DeteccionDeVariantes } from "@/lib/variants-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProductInputFormProps {
  onSubmit: (data: {
    mode: "single" | "bulk";
    content: string;
    sku: string;
    price?: number;
    stock?: number;
    images: File[];
    bulkFile?: File;
    zipFile?: File;
  }) => void;
  /** Producto con variantes: el recorrido terminó y hay que crear el grupo. */
  onSubmitVariants?: (data: {
    sku: string;
    content: string;
    images: File[];
    wizard: ResultadoDelRecorrido;
  }) => void;
  isProcessing: boolean;
  isFormReady?: boolean;
}

export function ProductInputForm({ onSubmit, onSubmitVariants, isProcessing, isFormReady = true }: ProductInputFormProps) {
  const { activeStore } = useStores();
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [singleProduct, setSingleProduct] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  // Variantes: null = sin responder (la IA revisa las fotos al generar), 'si' = recorrido, 'no' = producto simple.
  const [tiene, setTiene] = useState<"si" | "no" | null>(null);
  const [sugerencia, setSugerencia] = useState<DeteccionDeVariantes | null>(null);
  const [detectando, setDetectando] = useState(false);
  // El SKU que se asignaría si el usuario no escribe uno (formato de la tienda activa).
  const [skuSugerido, setSkuSugerido] = useState("");
  useEffect(() => {
    let vivo = true;
    variantsApi.nextSku().then((r) => { if (vivo && r.data?.skus?.[0]) setSkuSugerido(r.data.skus[0]); }).catch(() => undefined);
    return () => { vivo = false; };
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImages = useCallback((newFiles: File[]) => {
    const validFiles = newFiles.filter((f) => f.type.startsWith("image/"));
    if (!validFiles.length) return;

    setSugerencia(null);
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
    setSugerencia(null);
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

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setZipFile(file);
  };

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    addImages(files);
    // Reset input so same file can be re-added after removal
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const enviarProductoSimple = () =>
    onSubmit({
      mode: "single",
      content: singleProduct,
      sku,
      price: price ? parseFloat(price) : undefined,
      stock: stock !== "" ? Math.max(0, Math.trunc(Number(stock))) : undefined,
      images,
    });

  const handleSubmit = async () => {
    if (mode === "single") {
      // Filtro previo: si no se ha dicho nada sobre variantes, la IA revisa las fotos y el texto. Sin señales concretas no pregunta.
      if (tiene === null && images.length > 0) {
        setDetectando(true);
        let resultado: DeteccionDeVariantes | null = null;
        try {
          const resp = await variantsApi.detect(images, singleProduct);
          resultado = resp.data?.resultado ?? null;
        } catch {
          resultado = null;
        }
        setDetectando(false);
        if (resultado?.recomendar) {
          setSugerencia(resultado);
          return;
        }
      }
      enviarProductoSimple();
    } else if (bulkFile) {
      onSubmit({ mode: "bulk", content: bulkFile.name, sku: "", price: undefined, images: [], bulkFile, zipFile: zipFile ?? undefined });
    }
  };

  // Con fotos alcanza: el SKU se genera solo y la IA completa nombre, descripción, categoría y atributos.
  const isSingleDisabled = images.length === 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h3 className="font-semibold text-base md:text-lg text-[#111111] dark:text-[#F8F8F5]">Información del producto</h3>
        <p className="text-xs md:text-sm text-[#666666] dark:text-[#A1A1AA]">
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
          {/* SKU + Price + Stock row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <div className="space-y-1.5 md:space-y-2">
              <Label htmlFor="product-sku" className="text-xs md:text-sm text-[#111111] dark:text-[#F8F8F5] font-medium">
                SKU <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="product-sku"
                placeholder={skuSugerido ? `Vacío = se asigna ${skuSugerido}` : "Vacío = se genera solo"}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="bg-white dark:bg-[#1A1A1A] border-[#EAEAEA] dark:border-white/20 focus-visible:border-[#FCCB34] focus-visible:ring-[#FCCB34] h-10 md:h-12 text-sm px-4 shadow-sm dark:text-[#F8F8F5]"
              />
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <Label htmlFor="product-price" className="text-xs md:text-sm text-[#111111] dark:text-[#F8F8F5] font-medium">Precio (opcional)</Label>
              <Input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej: 1299.99"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-white dark:bg-[#1A1A1A] border-[#EAEAEA] dark:border-white/20 focus-visible:border-[#FCCB34] focus-visible:ring-[#FCCB34] h-10 md:h-12 text-sm px-4 shadow-sm dark:text-[#F8F8F5]"
              />
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <Label htmlFor="product-stock" className="text-xs md:text-sm text-[#111111] dark:text-[#F8F8F5] font-medium">Stock</Label>
              <Input
                id="product-stock"
                type="number"
                min="0"
                step="1"
                placeholder="Ej: 20"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="bg-white dark:bg-[#1A1A1A] border-[#EAEAEA] dark:border-white/20 focus-visible:border-[#FCCB34] focus-visible:ring-[#FCCB34] h-10 md:h-12 text-sm px-4 shadow-sm dark:text-[#F8F8F5]"
              />
            </div>
          </div>

          {/* Product name */}
          <div className="space-y-1.5 md:space-y-2">
            <Label htmlFor="product-name" className="text-xs md:text-sm text-[#111111] dark:text-[#F8F8F5] font-medium">Nombre del producto</Label>
            <Input
              id="product-name"
              placeholder="Ej: iPhone 15 Pro Max 256GB"
              className="bg-white dark:bg-[#1A1A1A] border-[#EAEAEA] dark:border-white/20 focus-visible:border-[#FCCB34] focus-visible:ring-[#FCCB34] h-10 md:h-12 text-sm px-4 shadow-sm dark:text-[#F8F8F5]"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5 md:space-y-2">
            <Label htmlFor="product-description" className="text-xs md:text-sm text-[#111111] dark:text-[#F8F8F5] font-medium">
              Descripción o información adicional <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="product-description"
              placeholder="Opcional: marca, modelo, medidas… La IA ya lee tus fotos; lo que escribas aquí tiene prioridad."
              value={singleProduct}
              onChange={(e) => setSingleProduct(e.target.value)}
              className="min-h-24 md:min-h-32 bg-white dark:bg-[#1A1A1A] border-[#EAEAEA] dark:border-white/20 focus-visible:border-[#FCCB34] focus-visible:ring-[#FCCB34] resize-none text-sm px-4 py-3 shadow-sm dark:text-[#F8F8F5]"
            />
          </div>

          {/* Image upload */}
          <div className="space-y-2 md:space-y-3">
            <Label className="text-xs md:text-sm text-[#111111] dark:text-[#F8F8F5] font-medium">
              Imágenes del producto <span className="text-red-500">*</span>
            </Label>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-[16px] p-4 md:p-6 text-center transition-all cursor-pointer select-none",
                isDragOver
                  ? "border-[#FCCB34] bg-[#FFF7D6] dark:bg-[#FCCB34]/20 scale-[1.01]"
                  : "border-[#EAEAEA] dark:border-white/20 bg-[#F8F8F5] dark:bg-[#1A1A1A] hover:border-[#FCCB34]/60 dark:hover:border-[#FCCB34]/60 hover:bg-[#FFF9E8] dark:hover:bg-[#FCCB34]/10"
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
                isDragOver ? "text-[#111111] dark:text-[#FCCB34]" : "text-[#666666] dark:text-[#A1A1AA]"
              )} />
              <p className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#F8F8F5]">
                {isDragOver ? "Suéltala aquí" : "Arrastra imágenes o haz clic para seleccionar"}
              </p>
              <p className="text-[10px] md:text-xs text-[#666666] dark:text-[#A1A1AA] mt-1">
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

          {/* Variantes */}
          {(
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-card/40 p-3 md:p-4">
                <p className="text-sm font-medium mb-2">¿Este producto tiene variantes?</p>
                <p className="text-[11px] text-muted-foreground mb-2">Por ejemplo, el mismo producto en varios colores o tallas.</p>
                <button type="button" onClick={() => { setTiene("no"); setSugerencia(null); }} className={cn("inline-flex rounded-lg border px-3 py-2 text-xs md:text-sm mr-2 transition-colors", tiene === "no" ? "border-[#FCCB34] bg-[#FCCB34]/15" : "border-border text-muted-foreground hover:border-[#FCCB34]/50")}>No, es un solo producto</button>
                <button type="button" onClick={() => setTiene("si")} className={cn("inline-flex rounded-lg border px-3 py-2 text-xs md:text-sm transition-colors", tiene === "si" ? "border-[#FCCB34] bg-[#FCCB34]/15" : "border-border text-muted-foreground hover:border-[#FCCB34]/50")}>Sí, tiene variantes</button>
              </div>

              {sugerencia && tiene === null && (
                <div className="rounded-xl border border-[#FCCB34]/60 bg-[#FCCB34]/10 p-3 md:p-4 animate-in fade-in slide-in-from-top-1 duration-300">
                  <p className="text-sm font-medium mb-1">Este producto parece tener variantes</p>
                  <p className="text-[11px] text-muted-foreground mb-2">Antes de crearlo como un solo producto, revisa lo que encontré:</p>
                  <ul className="space-y-1 mb-2">
                    {sugerencia.ejes.map((e) => (
                      <li key={e.name} className="text-xs">
                        <span className="font-medium">{e.name}: {e.values.join(" · ")}</span>
                        {e.evidence && <span className="text-muted-foreground"> — {e.evidence}</span>}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => setTiene("si")}>Sí, crear con variantes</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => { setTiene("no"); setSugerencia(null); enviarProductoSimple(); }}>No, es un solo producto</Button>
                  </div>
                </div>
              )}

              {tiene === "si" && images.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground animate-in fade-in duration-300">
                  Sube primero las fotos del producto (arriba): con ellas armas las variantes y asignas qué foto va en cada una.
                </p>
              )}

              {tiene === "si" && images.length > 0 && (
                <VariantsWizard
                  photos={previews.map((src) => ({ src }))}
                  parentSku={sku}
                  codigoSugerido={skuSugerido}
                  basePrice={price}
                  baseStock={stock}
                  deteccion={sugerencia}
                  busy={isProcessing}
                  onSubmit={(wizard) => onSubmitVariants?.({ sku: sku.trim(), content: singleProduct, images, wizard })}
                />
              )}
            </div>
          )}
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
                  <p className="font-medium text-sm md:text-base">Sube tu archivo Excel</p>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">
                    Columnas: precio, stock, fotos (SKU, nombre y descripción son opcionales)
                  </p>
                </>
              )}
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => bulkUploadApi.downloadProductTemplate(activeStore?.name).catch((e) => toast.error(e.message))}>
              <Download className="w-4 h-4 mr-2" />
              Descargar plantilla{activeStore ? ` de ${activeStore.name}` : ""}
            </Button>
            <input type="file" accept=".zip" onChange={handleZipChange} className="hidden" id="bulk-zip" />
            <Button type="button" variant="outline" size="sm" asChild>
              <label htmlFor="bulk-zip" className="cursor-pointer">
                <FileArchive className="w-4 h-4 mr-2" />
                {zipFile ? zipFile.name : "Subir ZIP con las fotos (JPG)"}
              </label>
            </Button>
            {zipFile && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setZipFile(null)}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 md:p-4 rounded-xl bg-accent/10 border border-accent/20">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-accent shrink-0 mt-0.5" />
            <p className="text-xs md:text-sm">
              <strong>Fotos sin enlaces:</strong> pon las fotos JPG en un ZIP. En la columna <em>fotos</em> escribe sus
              rutas separadas por coma, o déjala vacía y nómbralas con el SKU (MK-001.jpg, MK-001-2.jpg) o ponlas en una
              carpeta con el SKU. La IA completa lo demás. Los canales marcados arriba se aplican a las filas que no traen su propia columna <em>canales</em>.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {!(mode === "single" && tiene === "si") && (
      <Button
        onClick={handleSubmit}
        disabled={isProcessing || detectando || !isFormReady || (mode === "single" && isSingleDisabled) || (mode === "bulk" && !bulkFile)}
        className={cn(
          "w-full h-12 rounded-[12px] font-semibold text-sm md:text-base transition-all",
          (isProcessing || detectando || !isFormReady || (mode === "single" && isSingleDisabled) || (mode === "bulk" && !bulkFile))
            ? "bg-[#FFF3C4] dark:bg-[#333333] text-[#111111]/50 dark:text-[#A1A1AA] shadow-none cursor-not-allowed"
            : "bg-[#111111] dark:bg-[#FCCB34] hover:bg-[#222222] dark:hover:bg-[#E6B620] text-white dark:text-[#111111] shadow-[0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5"
        )}
      >
        {detectando ? (
          <>
            <Loader2 className="w-4 h-4 md:w-5 md:h-5 mr-2 animate-spin" />
            Revisando fotos…
          </>
        ) : isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 md:w-5 md:h-5 mr-2 animate-spin" />
            Procesando con IA...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 mr-2 text-[#FCCB34]" />
            Generar con IA
          </>
        )}
      </Button>
      )}
    </div>
  );
}
