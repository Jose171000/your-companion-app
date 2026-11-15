import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserListing, syncApi } from "@/lib/sync-api";
import { CanalDeDescuento, DescuentoDelProducto } from "./DescuentoDelProducto";
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
  /** Descuento general del producto (precio y fechas de vigencia) */
  promo?: { price: number | null; start: string | null; end: string | null } | null;
  /** Publicaciones del producto: de ahí salen los canales donde se puede poner un precio con descuento distinto */
  channels?: { listing: UserListing }[];
}

interface Props {
  product: EditableProduct | null;
  reviewMode: boolean;
  /** «stock»: solo el stock. «precios»: precio, descuento y precio web. Cada uno se aprueba por separado. */
  modo: "stock" | "precios";
  onClose: () => void;
}

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));

/** Edita el stock o los precios de un producto; con el modo revisión activo el cambio queda pendiente de aprobación. */
export function EditInventoryDialog({ product, reviewMode, modo, onClose }: Props) {
  const enStock = modo === "stock";
  const queryClient = useQueryClient();
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [webPrice, setWebPrice] = useState("");

  useEffect(() => {
    if (product) {
      setPrice(String(product.price));
      setStock(String(product.stock));
      setWebPrice(product.webPrice != null ? String(product.webPrice) : "");
    }
  }, [product]);

  // Las cuentas donde el producto está publicado (y que no pausaste tú): ahí se puede poner un precio con descuento propio.
  const canalesDeDescuento: CanalDeDescuento[] = (product?.channels ?? [])
    .map((c) => c.listing)
    .filter((l) => ["falabella", "mercadolibre", "woocommerce", "ripley"].includes(l.marketplace) && (l.syncStatus === "published" || l.syncStatus === "paused") && !l.pausedByUser)
    .map((l) => ({
      listingId: l.id,
      marketplace: l.marketplace,
      cuenta: l.accountLabel ?? null,
      // Ripley tiene su propia lista de precios; en los demás canales vale el precio propio de la cuenta o el del producto.
      precioRegular: l.ownPrice != null ? num(l.ownPrice) : l.marketplace === "ripley" ? num(l.regularPrice) : product?.price ?? null,
      mostrado: num(l.salePrice),
      propio: l.ownPromo?.price != null ? { price: Number(l.ownPromo.price), start: l.ownPromo.start ?? null, end: l.ownPromo.end ?? null } : null,
    }));

  const priceNum = Number(price);
  const stockNum = Number(stock);
  // Cada pestaña toca solo lo suyo: en «Stock» el precio no cuenta, y al revés.
  const priceChanged = !enStock && !!product && price !== "" && priceNum !== product.price;
  const stockChanged = enStock && !!product && stock !== "" && stockNum !== product.stock;
  // El precio web puede quedar vacío: eso lo quita.
  const webNum = webPrice === "" ? null : Number(webPrice);
  const webChanged = !enStock && !!product && webNum !== (product.webPrice != null ? Number(product.webPrice) : null);
  const invalid =
    (priceChanged && (Number.isNaN(priceNum) || priceNum < 0)) ||
    (stockChanged && (!Number.isInteger(stockNum) || stockNum < 0)) ||
    (webChanged && webNum !== null && (Number.isNaN(webNum) || webNum < 0));

  const mutation = useMutation({
    mutationFn: async () => {
      // El precio web se guarda aparte: no se envía a marketplaces ni pasa por revisión.
      if (webChanged) {
        const web = await syncApi.setWebPrice(product!.productId, webNum);
        if (web.error) return web;
        if (!priceChanged && !stockChanged) return web;
      }
      return syncApi.updateInventory(product!.productId, {
        ...(priceChanged ? { price: priceNum } : {}),
        ...(stockChanged ? { stock: stockNum } : {}),
      });
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
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>{enStock ? "Editar stock" : "Editar precios"}</DialogTitle>
          <DialogDescription className="break-words">
            {product?.name} · <code className="font-mono text-xs">{product?.sku}</code>
          </DialogDescription>
        </DialogHeader>

        {enStock ? (
          <div className="space-y-2">
            <Label htmlFor="inv-stock">Stock</Label>
            <Input
              id="inv-stock"
              type="number"
              min={0}
              step={1}
              autoFocus
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Hoy en Synkro: {product?.stock} u. Es el stock que se manda a todos los canales donde el producto está publicado.
            </p>
          </div>
        ) : (
          <>
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

            {product && (
              <DescuentoDelProducto
                productIds={[product.productId]}
                precioBase={priceChanged && !Number.isNaN(priceNum) ? priceNum : product.price}
                general={product.promo}
                canales={canalesDeDescuento}
                onDone={onClose}
              />
            )}
            {reviewMode && (
              <p className="text-[11px] text-muted-foreground -mt-1">
                Con el modo revisión encendido, el descuento no sale a ningún canal hasta que apruebes la solicitud de cada cuenta en el Tablero (o en Revisión).
              </p>
            )}

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
          </>
        )}

        <p className="text-xs text-muted-foreground">
          {reviewMode
            ? `El modo revisión está activo: ${enStock ? "el cambio de stock" : "el cambio de precio"} quedará pendiente hasta que lo apruebes aquí mismo, en la lista de pendientes.${enStock ? "" : " El precio web se guarda al instante."}`
            : "El modo revisión está apagado: el cambio se enviará de inmediato a los canales publicados."}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="gradient-primary"
            disabled={mutation.isPending || invalid || (!priceChanged && !stockChanged && !webChanged)}
            onClick={() => mutation.mutate()}
          >
            {reviewMode ? "Enviar a revisión" : "Guardar y sincronizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
