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
 * WooCommerce se conecta con la dirección de la tienda y una clave de la API
 * REST (Consumer Key + Consumer Secret) con permisos de lectura y escritura.
 * Se comprueban contra la tienda antes de guardarse; el secret queda cifrado
 * y no vuelve al navegador.
 */
export function ConnectWooCommerceDialog({ open, onOpenChange }: Props) {
  const [siteUrl, setSiteUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [label, setLabel] = useState("");
  const queryClient = useQueryClient();

  const reset = () => {
    setSiteUrl("");
    setConsumerKey("");
    setConsumerSecret("");
    setLabel("");
  };

  const connect = useMutation({
    mutationFn: () => syncApi.connectWooCommerce(siteUrl.trim(), consumerKey.trim(), consumerSecret.trim(), label),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Tienda WooCommerce conectada: ${res.data?.nickname ?? ""}`);
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

  const listo = siteUrl.trim().length > 0 && consumerKey.trim().length > 0 && consumerSecret.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Conectar WooCommerce
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Necesitas crear una clave de la API en tu WordPress:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Entra a <span className="font-medium">WooCommerce → Ajustes → Avanzado → API REST</span>.
                </li>
                <li>
                  Pulsa <span className="font-medium">Añadir clave</span>, con permisos de{" "}
                  <span className="font-medium">Lectura/Escritura</span>.
                </li>
                <li>Copia la Consumer Key y el Consumer Secret aquí abajo.</li>
              </ol>
              <p className="text-xs">
                Tu tienda debe usar https y tener activos los enlaces permanentes (cualquiera menos «Simple»). Y en cada
                producto, activa la gestión de inventario para que el stock se sincronice.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="woo-site">Dirección de la tienda</Label>
            <Input
              id="woo-site"
              autoComplete="off"
              placeholder="https://mitienda.com"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="woo-key">Consumer Key</Label>
            <Input
              id="woo-key"
              autoComplete="off"
              placeholder="ck_…"
              value={consumerKey}
              onChange={(e) => setConsumerKey(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="woo-secret">Consumer Secret</Label>
            <Input
              id="woo-secret"
              type="password"
              autoComplete="off"
              placeholder="cs_…"
              value={consumerSecret}
              onChange={(e) => setConsumerSecret(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && listo && !connect.isPending) connect.mutate();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="woo-label">Nombre de la cuenta (opcional)</Label>
            <Input
              id="woo-label"
              autoComplete="off"
              maxLength={60}
              placeholder="Ej. Tienda web"
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
