import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { Product, productsApi } from "@/lib/products-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

const TONES = [
  { id: "profesional",  label: "Profesional" },
  { id: "amigable",     label: "Amigable" },
  { id: "tecnico",      label: "Técnico" },
  { id: "entusiasta",   label: "Entusiasta" },
  { id: "persuasivo",   label: "Persuasivo" },
];

interface RegenerateAIDialogProps {
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function RegenerateAIDialog({
  product,
  onClose,
  onSuccess,
}: RegenerateAIDialogProps) {
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>([]);
  const [tone, setTone] = useState("profesional");
  const [isLoading, setIsLoading] = useState(false);

  // Sync state when product changes
  useEffect(() => {
    if (product) {
      setSelectedMarketplaces(product.targetMarketplaces ?? []);
      setTone(product.tone ?? "profesional");
    }
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMarketplace = (id: string) => {
    setSelectedMarketplaces((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!product) return;
    if (selectedMarketplaces.length === 0) {
      toast.error("Selecciona al menos un marketplace");
      return;
    }
    setIsLoading(true);
    try {
      // Desde la fila de un grupo la IA se llama UNA sola vez para todo el grupo (ejes, fotos de cada variante) y el resultado
      // se aplica a todas sus variantes. Un producto suelto se regenera como siempre.
      const grupoId = product.alGrupo ? product.group?.id : undefined;
      const response = grupoId
        ? await productsApi.generateGroupAI(grupoId, { targetMarketplaces: selectedMarketplaces, tone })
        : await productsApi.generateAI(product.id, { targetMarketplaces: selectedMarketplaces, tone });
      if (response?.error) {
        toast.error(response.error);
      } else {
        const n = (response as { data?: { variantes?: number } })?.data?.variantes ?? 0;
        toast.success(grupoId ? `Contenido IA regenerado una vez para las ${n || product.groupSummary?.variantCount} variantes ✨` : "Contenido IA regenerado exitosamente ✨");
        onSuccess();
        onClose();
      }
    } catch {
      toast.error("Error al conectar con el servidor");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      {/* [&>*]:min-w-0: un nombre largo no debe estirar la cuadrícula del diálogo más allá de su ancho. */}
      <DialogContent className="glass max-w-md overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-accent-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base">Regenerar con IA</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 break-words" title={product?.name}>
                {product?.name}{product?.alGrupo ? ` · ${product.groupSummary?.variantCount} variantes` : ""}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Marketplaces */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Marketplaces destino{" "}
              <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0">
              {MARKETPLACE_OPTIONS.map((mp) => {
                const isSelected = selectedMarketplaces.includes(mp.id);
                return (
                  <button
                    key={mp.id}
                    type="button"
                    onClick={() => toggleMarketplace(mp.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all duration-150 text-left",
                      isSelected
                        ? "border-accent bg-accent/15 text-foreground font-medium ring-1 ring-accent/40"
                        : "border-border bg-secondary/30 text-muted-foreground hover:border-accent/50"
                    )}
                  >
                    <span className="text-base">{mp.emoji}</span>
                    <span className="truncate">{mp.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tone */}
          <div className="space-y-2">
            <Label htmlFor="regen-ai-tone" className="text-sm font-medium">
              Tono de escritura
            </Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger
                id="regen-ai-tone"
                className="bg-secondary/50 border-border"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass">
                {TONES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            id="regen-ai-submit"
            onClick={handleSubmit}
            disabled={isLoading || selectedMarketplaces.length === 0}
            className="gradient-accent font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Regenerar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
