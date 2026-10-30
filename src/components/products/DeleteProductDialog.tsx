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
import { Loader2, Trash2 } from "lucide-react";
import { Product } from "@/lib/products-api";

interface DeleteProductDialogProps {
  product: Product | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteProductDialog({
  product,
  isDeleting,
  onConfirm,
  onClose,
}: DeleteProductDialogProps) {
  return (
    <AlertDialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="glass">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <AlertDialogTitle>{product?.alGrupo ? "¿Eliminar el producto con todas sus variantes?" : "¿Eliminar producto?"}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm leading-relaxed">
            Estás a punto de eliminar{" "}
            <span className="font-semibold text-foreground">
              &ldquo;{product?.name}&rdquo;
            </span>{" "}
            {product?.alGrupo ? (
              <>
                {" "}y sus <span className="font-semibold text-foreground">{product.groupSummary?.variantCount ?? 0} variantes</span>.
              </>
            ) : (
              <>
                (SKU:{" "}
                <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">
                  {product?.sku}
                </code>
                ).
              </>
            )}
            <br />
            <span className="text-destructive/80 font-medium">
              Esta acción no se puede deshacer.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isDeleting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Sí, eliminar
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
