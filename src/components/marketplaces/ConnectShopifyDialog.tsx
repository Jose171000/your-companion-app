import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncApi } from "@/lib/sync-api";
import { toast } from "sonner";
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
import { KeyRound, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shopify se conecta con el dominio *.myshopify.com de la tienda y el token de
 * acceso de una app personalizada. Se comprueban (token y permisos) contra
 * Shopify antes de guardarse; el token queda cifrado y no vuelve al navegador.
 */
export function ConnectShopifyDialog({ open, onOpenChange }: Props) {
  const [shop, setShop] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [label, setLabel] = useState("");
  const queryClient = useQueryClient();

  const reset = () => {
    setShop("");
    setAccessToken("");
    setLabel("");
  };

  const connect = useMutation({
    mutationFn: () => syncApi.connectShopify(shop.trim(), accessToken.trim(), label),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Tienda Shopify conectada: ${res.data?.nickname ?? ""}`);
      queryClient.invalidateQueries({ queryKey: ["sync-connections"] });
      reset();
      onOpenChange(false);
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const listo = shop.trim().length > 0 && accessToken.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Conectar Shopify
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Necesitas crear una app personalizada en tu Shopify:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Entra a <span className="font-medium">Configuración → Aplicaciones y canales de venta → Desarrollar apps</span>.
                </li>
                <li>Crea una app y, en la configuración de su Admin API, dale estos permisos:</li>
              </ol>
              <p className="text-xs font-mono bg-secondary/40 rounded-md px-2 py-1.5">
                read_products, write_products, read_inventory, write_inventory, read_orders, read_locations
              </p>
              <ol className="list-decimal list-inside space-y-1" start={3}>
                <li>
                  Instala la app y copia el <span className="font-medium">token de acceso</span> (empieza por shpat_).
                </li>
              </ol>
              <p className="text-xs">
                Sin el permiso extra <span className="font-mono">read_all_orders</span>, Shopify solo entrega las ventas de
                los últimos 60 días al importar el historial.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="shopify-shop">Dominio de la tienda</Label>
            <Input
              id="shopify-shop"
              autoComplete="off"
              placeholder="mitienda.myshopify.com"
              value={shop}
              onChange={(e) => setShop(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Es el dominio .myshopify.com (Configuración → Dominios), no tu dominio propio.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shopify-token">Token de acceso de la Admin API</Label>
            <Input
              id="shopify-token"
              type="password"
              autoComplete="off"
              placeholder="shpat_…"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && listo && !connect.isPending) connect.mutate();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shopify-label">Nombre de la cuenta (opcional)</Label>
            <Input
              id="shopify-label"
              autoComplete="off"
              maxLength={60}
              placeholder="Ej. Tienda online"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={connect.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => connect.mutate()} disabled={!listo || connect.isPending}>
            {connect.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
            {connect.isPending ? "Comprobando…" : "Conectar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
