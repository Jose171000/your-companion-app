import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { syncApi } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface EditableProduct {
  productId: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
}

interface Props {
  product: EditableProduct | null;
  reviewMode: boolean;
  onClose: () => void;
}

/** Edita precio y stock; con el modo revisión activo el cambio queda pendiente. */
export function EditInventoryDialog({ product, reviewMode, onClose }: Props) {
  const queryClient = useQueryClient();
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  useEffect(() => {
    if (product) {
      setPrice(String(product.price));
      setStock(String(product.stock));
    }
  }, [product]);

  const priceNum = Number(price);
  const stockNum = Number(stock);
  const priceChanged = !!product && price !== "" && priceNum !== product.price;
  const stockChanged = !!product && stock !== "" && stockNum !== product.stock;
  const invalid =
    (priceChanged && (Number.isNaN(priceNum) || priceNum < 0)) ||
    (stockChanged && (!Number.isInteger(stockNum) || stockNum < 0));

  const mutation = useMutation({
    mutationFn: () =>
      syncApi.updateInventory(product!.productId, {
        ...(priceChanged ? { price: priceNum } : {}),
        ...(stockChanged ? { stock: stockNum } : {}),
      }),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message ?? "Cambio guardado");
      queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
      queryClient.invalidateQueries({ queryKey: ["sync-change-requests"] });
      onClose();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  return (
    <Dialog open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar precio y stock</DialogTitle>
          <DialogDescription>
            {product?.name} · <code className="font-mono text-xs">{product?.sku}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="inv-price">Precio</Label>
            <Input
              id="inv-price"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-stock">Stock</Label>
            <Input
              id="inv-stock"
              type="number"
              min={0}
              step={1}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {reviewMode
            ? "El modo revisión está activo: el cambio quedará pendiente hasta que lo apruebes en la pestaña Revisión."
            : "El modo revisión está apagado: el cambio se enviará de inmediato a los canales publicados."}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="gradient-primary"
            disabled={mutation.isPending || invalid || (!priceChanged && !stockChanged)}
            onClick={() => mutation.mutate()}
          >
            {reviewMode ? "Enviar a revisión" : "Guardar y sincronizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
