import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AIProductsModule } from "@/components/ai-products/AIProductsModule";
import { Sparkles } from "lucide-react";

/**
 * «Nuevo producto»: el mismo flujo de IA Productos, en una ventana. Con fotos, SKU, precio y stock la IA
 * categoriza, llena los atributos, genera la descripción y publica en los canales elegidos.
 */
export function NewProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Nuevo producto
          </DialogTitle>
          <DialogDescription>
            Elige los canales y sube las fotos, el SKU, el precio y el stock. La descripción es opcional: la IA completa el resto y lo publica.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <AIProductsModule
            compact
            onCreated={() => {
              queryClient.invalidateQueries({ queryKey: ["products"] });
              queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
