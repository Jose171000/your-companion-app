import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit, FileWarning, ImagePlus, Loader2, Save, Sparkles, X } from "lucide-react";
import { Product, productsApi } from "@/lib/products-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useFormDraft } from "@/contexts/FormDraftContext";

// ─── Constants ───────────────────────────────────────────────────────────────

const MARKETPLACE_OPTIONS = [
  { id: "mercadolibre", name: "MercadoLibre", emoji: "🛒" },
  { id: "amazon",       name: "Amazon",       emoji: "📦" },
  { id: "shopify",      name: "Shopify",      emoji: "🛍️" },
  { id: "woocommerce",  name: "WooCommerce",  emoji: "🔮" },
  { id: "falabella",    name: "Falabella",    emoji: "🏬" },
  { id: "ripley",       name: "Ripley",       emoji: "🏪" },
  { id: "juntoz",       name: "Juntoz",       emoji: "🎯" },
  { id: "yape",         name: "Yape",         emoji: "💜" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProductFormDialogProps {
  open: boolean;
  product?: Product;     // provided → edit mode; undefined → create mode
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductFormDialog({
  open,
  product,
  onClose,
  onSuccess,
}: ProductFormDialogProps) {
  const isEdit = !!product;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setDirty } = useFormDraft();

  // Form state
  const [sku, setSku]                     = useState("");
  const [name, setName]                   = useState("");
  const [description, setDescription]     = useState("");
  const [category, setCategory]           = useState("");
  const [subCategory, setSubCategory]     = useState("");
  const [price, setPrice]                 = useState("");
  const [stock, setStock]                 = useState("");
  const [selectedMps, setSelectedMps]     = useState<string[]>([]);
  const [images, setImages]               = useState<File[]>([]);
  const [previews, setPreviews]           = useState<string[]>([]);
  const [isDragOver, setIsDragOver]       = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [closeWarning, setCloseWarning]   = useState(false);

  // ── Reset form whenever the dialog opens or the target product changes ──────
  useEffect(() => {
    if (!open) return;
    if (product) {
      setSku(product.sku);
      setName(product.name);
      setDescription(product.description);
      setCategory(product.category ?? "");
      setSubCategory(product.subCategory ?? "");
      setPrice(product.price != null ? String(product.price) : "");
      setStock(product.stock != null ? String(product.stock) : "");
      setSelectedMps(product.targetMarketplaces ?? []);
    } else {
      setSku(""); setName(""); setDescription(""); setCategory("");
      setSubCategory(""); setPrice(""); setStock(""); setSelectedMps([]);
    }
    // Always reset image state for new session
    setImages([]);
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPreviews([]);
  }, [open, product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Image helpers ─────────────────────────────────────────────────────────
  const addImages = useCallback((files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (!valid.length) return;
    setImages((prev) => [...prev, ...valid]);
    valid.forEach((f) => {
      const url = URL.createObjectURL(f);
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
    addImages(Array.from(e.dataTransfer.files));
  };

  // ── Marketplace toggle ────────────────────────────────────────────────────
  const toggleMp = (id: string) =>
    setSelectedMps((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      toast.error("Nombre y descripción son obligatorios");
      return;
    }
    if (!isEdit && !sku.trim()) {
      toast.error("El SKU es obligatorio");
      return;
    }
    if (!isEdit && images.length === 0) {
      toast.error("Sube al menos una imagen del producto");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && product) {
        const resp = await productsApi.update(product.id, {
          name:               name.trim() || undefined,
          description:        description.trim() || undefined,
          category:           category.trim() || undefined,
          subCategory:        subCategory.trim() || undefined,
          price:              price ? parseFloat(price) : undefined,
          stock:              stock ? parseInt(stock, 10) : undefined,
          targetMarketplaces: selectedMps.length ? selectedMps : undefined,
        });
        if (resp.error) { toast.error(resp.error); return; }
        toast.success("Producto actualizado correctamente");
      } else {
        const dto = {
          sku:                sku.trim(),
          name:               name.trim(),
          description:        description.trim(),
          category:           category.trim() || undefined,
          subCategory:        subCategory.trim() || undefined,
          price:              price ? parseFloat(price) : undefined,
          stock:              stock ? parseInt(stock, 10) : undefined,
          targetMarketplaces: selectedMps.length ? selectedMps : undefined,
        };
        const resp = await productsApi.createWithAIAndFiles(dto, images);
        if (resp.error) { toast.error(resp.error); return; }
        toast.success("Producto creado con IA exitosamente ✨");
      }
      onSuccess();
      onClose();
    } catch {
      toast.error("Error al conectar con el servidor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    !isSubmitting &&
    name.trim() !== "" &&
    description.trim() !== "" &&
    (isEdit || (sku.trim() !== "" && images.length > 0));

  // ── Dirty detection ───────────────────────────────────────────────────────
  const formIsDirty = isEdit
    ? name !== (product?.name ?? "") ||
      description !== (product?.description ?? "") ||
      category !== (product?.category ?? "") ||
      subCategory !== (product?.subCategory ?? "") ||
      price !== (product?.price != null ? String(product.price) : "") ||
      stock !== (product?.stock != null ? String(product.stock) : "") ||
      JSON.stringify([...selectedMps].sort()) !==
        JSON.stringify([...(product?.targetMarketplaces ?? [])].sort())
    : sku.trim() !== "" ||
      name.trim() !== "" ||
      description.trim() !== "" ||
      category.trim() !== "" ||
      subCategory.trim() !== "" ||
      price !== "" ||
      stock !== "" ||
      selectedMps.length > 0 ||
      images.length > 0;

  // Register dirty state in context (so navigation guard can detect it)
  useEffect(() => {
    setDirty("products", open && formIsDirty);
    return () => setDirty("products", false); // clear on unmount
  }, [open, formIsDirty, setDirty]);

  // ── Close handling (with unsaved-changes guard) ───────────────────────────
  const handleCloseAttempt = () => {
    if (isSubmitting) return;
    if (formIsDirty) {
      setCloseWarning(true);
      return;
    }
    onClose();
  };

  const handleDiscardAndClose = () => {
    setCloseWarning(false);
    setDirty("products", false);
    onClose();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && handleCloseAttempt()}>
      <DialogContent className="glass max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                isEdit ? "bg-primary/10" : "gradient-primary glow-primary"
              )}
            >
              {isEdit ? (
                <Edit className="w-5 h-5 text-primary" />
              ) : (
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              )}

            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base">
                {isEdit ? "Editar Producto" : "Crear Producto con IA"}
              </DialogTitle>
              {isEdit && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  SKU:{" "}
                  <code className="font-mono bg-secondary px-1.5 py-0.5 rounded">
                    {product?.sku}
                  </code>
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* ── Scrollable body ───────────────────────────────────────────────── */}
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-5 py-5">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="pf-name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pf-name"
                placeholder="Nombre del producto"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-secondary/50 border-border h-11"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="pf-description">
                Descripción <span className="text-destructive">*</span>
                {!isEdit && (
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    La IA la usará para generar contenido optimizado
                  </span>
                )}
              </Label>
              <Textarea
                id="pf-description"
                placeholder="Describe el producto: características, especificaciones, usos..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-secondary/50 border-border resize-none min-h-[100px]"
              />
            </div>

            {/* Category + SubCategory */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pf-category">Categoría</Label>
                <Input
                  id="pf-category"
                  placeholder="Ej: Electrónica"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-secondary/50 border-border h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pf-subcategory">Subcategoría</Label>
                <Input
                  id="pf-subcategory"
                  placeholder="Ej: Smartphones"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="bg-secondary/50 border-border h-11"
                />
              </div>
            </div>

            <Separator />

            {/* SKU + Price + Stock */}
            <div className={cn("grid gap-4", isEdit ? "grid-cols-2" : "grid-cols-3")}>
              {!isEdit && (
                <div className="space-y-2">
                  <Label htmlFor="pf-sku">
                    SKU <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="pf-sku"
                    placeholder="Ej: PROD-001"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="bg-secondary/50 border-border h-11"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="pf-price">Precio</Label>
                <Input
                  id="pf-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="bg-secondary/50 border-border h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pf-stock">Stock</Label>
                <Input
                  id="pf-stock"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="bg-secondary/50 border-border h-11"
                />
              </div>
            </div>

            <Separator />

            {/* Marketplaces */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Marketplaces destino</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MARKETPLACE_OPTIONS.map((mp) => {
                  const sel = selectedMps.includes(mp.id);
                  return (
                    <button
                      key={mp.id}
                      type="button"
                      onClick={() => toggleMp(mp.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs transition-all duration-150",
                        sel
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      <span className="text-base">{mp.emoji}</span>
                      <span className="truncate">{mp.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Images: create mode ────────────────────────────────────── */}
            {!isEdit && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label>
                    Imágenes <span className="text-destructive">*</span>
                  </Label>

                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer select-none",
                      isDragOver
                        ? "border-primary bg-primary/10 scale-[1.01]"
                        : "border-border hover:border-primary/50 hover:bg-secondary/20"
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addImages(Array.from(e.target.files ?? []));
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    />
                    <ImagePlus
                      className={cn(
                        "w-7 h-7 mx-auto mb-2 transition-colors",
                        isDragOver ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <p className="text-sm font-medium">
                      {isDragOver ? "Suéltala aquí" : "Arrastra o haz clic para subir imágenes"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG, WEBP · múltiples imágenes
                    </p>
                  </div>

                  {/* Previews */}
                  {previews.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {previews.map((src, i) => (
                        <div
                          key={i}
                          className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-secondary/50"
                        >
                          <img
                            src={src}
                            alt={`Vista previa ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-background/80 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:border-destructive hover:text-destructive-foreground"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Images: edit mode (read-only preview) ─────────────────── */}
            {isEdit && (product?.images?.length ?? 0) > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Imágenes actuales</Label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {product!.images.map((img) => (
                      <div
                        key={img.id}
                        className="aspect-square rounded-lg overflow-hidden border border-border bg-secondary/50"
                      >
                        <img
                          src={img.url}
                          alt="Imagen del producto"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button
            variant="ghost"
            onClick={handleCloseAttempt}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            id="product-form-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="gradient-primary glow-primary font-semibold min-w-[160px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEdit ? "Guardando..." : "Creando con IA..."}
              </>
            ) : isEdit ? (
              <>
                <Save className="w-4 h-4 mr-2" />
                Guardar cambios
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Crear con IA
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* ── Close confirmation (unsaved changes) ──────────────────────────── */}
    <AlertDialog open={closeWarning} onOpenChange={(o) => !o && setCloseWarning(false)}>
      <AlertDialogContent className="glass max-w-sm">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <FileWarning className="w-5 h-5 text-amber-500" />
            </div>
            <AlertDialogTitle>¿Cerrar sin guardar?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="leading-relaxed">
            Tienes datos ingresados en el formulario que se perderán si cierras.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={() => setCloseWarning(false)} className="border-border">
            Seguir editando
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDiscardAndClose}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Descartar datos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
