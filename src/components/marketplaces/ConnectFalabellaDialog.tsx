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
 * Falabella pide dos datos: el UserID (que es el correo de la cuenta de
 * Seller Center) y la API key. Los dos se comprueban contra Falabella antes
 * de guardarse; la clave se guarda cifrada y no vuelve al navegador.
 */
export function ConnectFalabellaDialog({ open, onOpenChange }: Props) {
  const [userId, setUserId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const queryClient = useQueryClient();

  const connect = useMutation({
    mutationFn: () => syncApi.connectFalabella(userId.trim(), apiKey.trim(), label),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Cuenta de Falabella conectada: ${res.data?.nickname ?? ""}`);
      queryClient.invalidateQueries({ queryKey: ["sync-connections"] });
      setUserId("");
      setApiKey("");
      setLabel("");
      onOpenChange(false);
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const close = (next: boolean) => {
    if (!next) {
      setUserId("");
      setApiKey("");
      setLabel("");
    }
    onOpenChange(next);
  };

  const listo = userId.trim().length > 0 && apiKey.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Conectar Falabella
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Necesitas dos datos de tu Seller Center:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>El <span className="font-medium">UserID</span>, que es el correo de tu cuenta.</li>
                <li>La <span className="font-medium">API key</span>, en Integraciones → API.</li>
              </ol>
              <p className="text-xs">
                Se comprueban contra Falabella antes de guardarse. La clave queda cifrada y
                nunca sale de tu servidor.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="falabella-user-id">UserID (correo de la cuenta)</Label>
            <Input
              id="falabella-user-id"
              type="email"
              autoComplete="off"
              placeholder="vendedor@miempresa.com"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="falabella-api-key">API Key</Label>
            <Input
              id="falabella-api-key"
              type="password"
              autoComplete="off"
              placeholder="••••••••••••••••"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && listo && !connect.isPending) connect.mutate();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="falabella-label">Nombre de la cuenta (opcional)</Label>
            <Input
              id="falabella-label"
              autoComplete="off"
              maxLength={60}
              placeholder="Ej. Cuenta principal"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Sirve para distinguirla de otras cuentas del mismo canal.</p>
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
