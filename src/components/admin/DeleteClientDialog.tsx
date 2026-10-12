import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, AdminClient } from "@/lib/admin-api";
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
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

interface DeleteClientDialogProps {
  client: AdminClient | null;
  onClose: () => void;
}

export function DeleteClientDialog({ client, onClose }: DeleteClientDialogProps) {
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    setConfirmText("");
  }, [client]);

  const deleteMutation = useMutation({
    mutationFn: () => adminApi.deleteClient(client!.id),
    onSuccess: (res) => {
      if (res.error) return toast.error(res.error);
      toast.success(res.data?.message ?? "Cuenta eliminada");
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin-finance"] });
      onClose();
    },
    onError: () => toast.error("Error al eliminar la cuenta"),
  });

  // Con datos asociados exigimos escribir el correo: evita borrados por error
  const requiresTyping = true;
  const canDelete =
    !deleteMutation.isPending &&
    (!requiresTyping || confirmText.trim().toLowerCase() === client?.email.toLowerCase());

  return (
    <Dialog open={client !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Eliminar cuenta
          </DialogTitle>
          <DialogDescription>
            Vas a eliminar a{" "}
            <span className="font-semibold text-foreground">
              {client?.profile?.businessName || `${client?.name} ${client?.lastName}`}
            </span>{" "}
            ({client?.email}). Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/5 space-y-1">
            <p className="text-sm font-medium">Se borrará también:</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">
              <li>Las tiendas de las que es dueño, con sus ventas, productos y canales conectados</li>
              <li>{client?.stats.products ?? 0} productos y sus imágenes</li>
              <li>{client?.stats.publishedListings ?? 0} publicaciones sincronizadas</li>
              <li>Sus conexiones a marketplaces y su historial de pagos</li>
            </ul>
            <p className="text-xs text-muted-foreground pt-1">
              Sus publicaciones ya creadas en Mercado Libre no se eliminan, pero Synkro dejará de
              gestionarlas.
            </p>
          </div>

          {requiresTyping && (
            <div className="space-y-2">
              <Label>
                Para confirmar, escribe <span className="font-mono text-xs">{client?.email}</span>
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={client?.email}
                autoComplete="off"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={!canDelete}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Eliminar definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
