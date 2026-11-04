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
 * Mercado Ripley (Mirakl) se conecta con la clave de API de la tienda. Se comprueba contra Ripley antes de
 * guardarse; la clave queda cifrada y no vuelve al navegador. Por ahora Synkro solo LEE ofertas y pedidos:
 * aceptar y despachar se hace en el portal de vendedor, y aquí solo se actualiza el estado del pedido.
 */
export function ConnectRipleyDialog({ open, onOpenChange }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [site, setSite] = useState("");
  const [label, setLabel] = useState("");
  const queryClient = useQueryClient();

  const reset = () => {
    setApiKey("");
    setSite("");
    setLabel("");
  };

  const connect = useMutation({
    mutationFn: () => syncApi.connectRipley(apiKey.trim(), site.trim(), label),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Ripley conectado: ${res.data?.nickname ?? ""}`);
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

  const listo = apiKey.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Conectar Mercado Ripley
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Necesitas la clave de API de tu tienda:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Entra al portal de vendedor de Ripley.</li>
                <li>
                  Pulsa tu correo (arriba a la derecha) → <span className="font-medium">Configuración</span> →{" "}
                  <span className="font-medium">Clave API</span>.
                </li>
                <li>Copia la clave y pégala aquí.</li>
              </ol>
              <p className="text-xs">
                Por ahora Synkro solo lee tus ofertas y tus pedidos: aceptas y despachas los pedidos en el portal de
                Ripley, y aquí se actualiza su estado (aceptado, enviado, recibido, cancelado). No se envía stock ni
                precio a Ripley.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="ripley-key">Clave de API</Label>
            <Input
              id="ripley-key"
              type="password"
              autoComplete="off"
              placeholder="Pega aquí la clave"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && listo && !connect.isPending) connect.mutate();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ripley-site">Dirección del portal (opcional)</Label>
            <Input
              id="ripley-site"
              autoComplete="off"
              placeholder="ripleyperu-prod.mirakl.net"
              value={site}
              onChange={(e) => setSite(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Déjala vacía para Ripley Perú. Solo se aceptan direcciones que terminen en .mirakl.net.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ripley-label">Nombre de la cuenta (opcional)</Label>
            <Input
              id="ripley-label"
              autoComplete="off"
              maxLength={60}
              placeholder="Ej. Ripley Perú"
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
