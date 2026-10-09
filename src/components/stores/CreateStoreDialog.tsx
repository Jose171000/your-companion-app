import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { storesApi } from "@/lib/stores-api";
import { useStores } from "@/contexts/StoreContext";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateStoreDialog({ open, onOpenChange }: Props) {
  const { refresh, setActiveStore } = useStores();
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: () => storesApi.create(name.trim()),
    onSuccess: (res) => {
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudo crear la tienda");
        return;
      }
      toast.success(`Tienda "${res.data.name}" creada`);
      setActiveStore(res.data.id);
      refresh();
      setName("");
      onOpenChange(false);
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva tienda</DialogTitle>
          <DialogDescription>
            Cada tienda tiene sus propias conexiones con marketplaces y su propio equipo. Tú quedas como dueño.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="store-name">Nombre de la tienda</Label>
          <Input
            id="store-name"
            autoFocus
            placeholder="Ej. Rivesi Home"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim().length >= 2 && mutation.mutate()}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="gradient-primary"
            disabled={name.trim().length < 2 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Crear tienda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
