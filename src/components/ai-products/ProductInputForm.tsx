import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductInputFormProps {
  onSubmit: (data: { mode: "single" | "bulk"; content: string }) => void;
  isProcessing: boolean;
}

export function ProductInputForm({ onSubmit, isProcessing }: ProductInputFormProps) {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [singleProduct, setSingleProduct] = useState("");
  const [bulkFile, setBulkFile] = useState<File | null>(null);

  const handleSubmit = () => {
    if (mode === "single") {
      onSubmit({ mode: "single", content: singleProduct });
    } else if (bulkFile) {
      onSubmit({ mode: "bulk", content: bulkFile.name });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBulkFile(file);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-lg">Información del producto</h3>
        <p className="text-sm text-muted-foreground">
          Ingresa los datos básicos y la IA completará el resto
        </p>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "bulk")}>
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
          <TabsTrigger value="single" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Producto individual
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Carga masiva
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-name">Nombre del producto</Label>
            <Input
              id="product-name"
              placeholder="Ej: iPhone 15 Pro Max 256GB"
              className="bg-secondary/50 border-border h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-description">
              Descripción o información adicional
            </Label>
            <Textarea
              id="product-description"
              placeholder="Describe el producto, características, especificaciones técnicas, o cualquier información que tengas disponible. La IA usará esto para generar el contenido optimizado."
              value={singleProduct}
              onChange={(e) => setSingleProduct(e.target.value)}
              className="min-h-32 bg-secondary/50 border-border resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Imágenes del producto (opcional)</Label>
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Arrastra imágenes aquí o haz clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG hasta 10MB
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bulk" className="mt-6 space-y-4">
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer",
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
                  "w-12 h-12 mx-auto mb-4",
                  bulkFile ? "text-primary" : "text-muted-foreground"
                )}
              />
              {bulkFile ? (
                <>
                  <p className="font-medium text-primary">{bulkFile.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Archivo listo para procesar
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Sube tu archivo CSV o Excel</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Incluye las columnas: nombre, descripción, SKU, precio
                  </p>
                </>
              )}
            </label>
          </div>

          <div className="flex items-center gap-2 p-4 rounded-xl bg-accent/10 border border-accent/20">
            <Sparkles className="w-5 h-5 text-accent" />
            <p className="text-sm">
              <strong>Pro tip:</strong> Puedes incluir información parcial, la IA
              completará los campos faltantes.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <Button
        onClick={handleSubmit}
        disabled={isProcessing || (mode === "single" && !singleProduct) || (mode === "bulk" && !bulkFile)}
        className="w-full h-12 gradient-primary text-primary-foreground font-semibold text-base glow-primary"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Procesando con IA...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            Generar con IA
          </>
        )}
      </Button>
    </div>
  );
}
