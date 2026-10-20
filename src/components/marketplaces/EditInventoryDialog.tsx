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
  /** Precio con descuento de la tienda web (no va a ningún marketplace) */
  webPrice?: number | null;
  /** Precio con descuento y fechas de vigencia en Falabella */
  promo?: { price: number | null; start: string | null; end: string | null } | null;
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
  const [webPrice, setWebPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleStart, setSaleStart] = useState("");
  const [saleEnd, setSaleEnd] = useState("");

  useEffect(() => {
    if (product) {
      setPrice(String(product.price));
      setStock(String(product.stock));
      setWebPrice(product.webPrice != null ? String(product.webPrice) : "");
      setSalePrice(product.promo?.price != null ? String(product.promo.price) : "");
      setSaleStart(product.promo?.start ?? "");
      setSaleEnd(product.promo?.end ?? "");
    }
  }, [product]);

  const priceNum = Number(price);
  const stockNum = Number(stock);
  const priceChanged = !!product && price !== "" && priceNum !== product.price;
  const stockChanged = !!product && stock !== "" && stockNum !== product.stock;
  // El precio web puede quedar vacío: eso lo quita.
  const webNum = webPrice === "" ? null : Number(webPrice);
  const webChanged = !!product && webNum !== (product.webPrice != null ? Number(product.webPrice) : null);
  // Promoción en Falabella: precio con descuento (menor que el precio) y fechas opcionales.
  const saleNum = salePrice === "" ? null : Number(salePrice);
  const promoChanged =
    !!product &&
    (saleNum !== (product.promo?.price != null ? Number(product.promo.price) : null) ||
      saleStart !== (product.promo?.start ?? "") ||
      saleEnd !== (product.promo?.end ?? ""));
  const precioBase = priceChanged ? priceNum : product?.price ?? 0;
  const promoInvalid =
    saleNum !== null &&
    (Number.isNaN(saleNum) || saleNum <= 0 || saleNum >= precioBase || (saleStart !== "" && saleEnd !== "" && saleEnd < saleStart));
  const invalid =
    promoInvalid ||
    (priceChanged && (Number.isNaN(priceNum) || priceNum < 0)) ||
    (stockChanged && (!Number.isInteger(stockNum) || stockNum < 0)) ||
    (webChanged && webNum !== null && (Number.isNaN(webNum) || webNum < 0));

  const mutation = useMutation({
    mutationFn: async () => {
      // El precio web se guarda aparte: no se envía a marketplaces ni pasa por revisión.
      if (webChanged) {
        const web = await syncApi.setWebPrice(product!.productId, webNum);
        if (web.error) return web;
        if (!priceChanged && !stockChanged && !promoChanged) return web;
      }
      // La promoción se guarda y se envía a Falabella al instante (no pasa por revisión), igual que el precio web.
      // Va después del precio: el descuento se valida contra el precio regular ya guardado.
      let ultimo: Awaited<ReturnType<typeof syncApi.updateInventory>> | null = null;
      if (priceChanged || stockChanged) {
        ultimo = await syncApi.updateInventory(product!.productId, {
          ...(priceChanged ? { price: priceNum } : {}),
          ...(stockChanged ? { stock: stockNum } : {}),
        });
        if (ultimo.error) return ultimo;
      }
      if (promoChanged) {
        const promo = await syncApi.setPromo(product!.productId, {
          salePrice: saleNum,
          saleStartDate: saleNum !== null && saleStart ? saleStart : null,
          saleEndDate: saleNum !== null && saleEnd ? saleEnd : null,
        });
        if (promo.error || !ultimo) return promo;
      }
      return ultimo!;
    },
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

        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label htmlFor="inv-sale">Precio con descuento en Falabella</Label>
          <Input
            id="inv-sale"
            type="number"
            min={0}
            step="0.01"
            placeholder="Sin descuento"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="inv-sale-start" className="text-xs">Desde (opcional)</Label>
              <Input id="inv-sale-start" type="date" value={saleStart} onChange={(e) => setSaleStart(e.target.value)} disabled={salePrice === ""} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-sale-end" className="text-xs">Hasta (opcional)</Label>
              <Input id="inv-sale-end" type="date" value={saleEnd} onChange={(e) => setSaleEnd(e.target.value)} disabled={salePrice === ""} />
            </div>
          </div>
          {promoInvalid ? (
            <p className="text-[11px] text-red-400">El descuento debe ser menor que el precio ({precioBase.toFixed(2)}) y la fecha final no puede ser anterior a la inicial.</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Se envía a Falabella como precio especial, con sus fechas. No pasa por revisión. Para quitar un descuento ya enviado, hazlo en el Seller Center.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="inv-web">Precio web (con descuento)</Label>
          <Input
            id="inv-web"
            type="number"
            min={0}
            step="0.01"
            placeholder="Sin precio web"
            value={webPrice}
            onChange={(e) => setWebPrice(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Es el precio de tu tienda web. Se enviará a WooCommerce cuando esa conexión esté lista; no afecta a los marketplaces.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          {reviewMode
            ? "El modo revisión está activo: los cambios de precio y stock quedarán pendientes hasta que los apruebes en la pestaña Revisión. El precio web se guarda al instante."
            : "El modo revisión está apagado: el cambio se enviará de inmediato a los canales publicados."}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="gradient-primary"
            disabled={mutation.isPending || invalid || (!priceChanged && !stockChanged && !webChanged && !promoChanged)}
            onClick={() => mutation.mutate()}
          >
            {reviewMode ? "Enviar a revisión" : "Guardar y sincronizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
