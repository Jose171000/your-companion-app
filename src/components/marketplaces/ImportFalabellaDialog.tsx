import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { FalabellaImportSummary, syncApi } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const ESTADOS: Record<string, string> = {
  published: "Publicadas",
  pending: "En revisión de Falabella",
  paused: "Pausadas",
  error: "Rechazadas",
};

/**
 * Importa lo que el vendedor ya tiene en Falabella. Primero se muestra una
 * vista previa que no escribe nada; solo al confirmar se traen los productos.
 */
export function ImportFalabellaDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<FalabellaImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: () => syncApi.importFalabellaListings(true),
    onSuccess: (res) => {
      if (res.error || !res.data) setError(res.error ?? "No se pudo leer Falabella");
      else setPreview(res.data);
    },
    onError: () => setError("Error al conectar con el servidor"),
  });

  const importMutation = useMutation({
    mutationFn: () => syncApi.importFalabellaListings(false),
    onSuccess: (res) => {
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudo importar");
        return;
      }
      toast.success(`Falabella: ${res.data.enlazadas} publicaciones importadas`);
      queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  // Cada vez que se abre, se pide una vista previa nueva.
  useEffect(() => {
    if (open) {
      setPreview(null);
      setError(null);
      previewMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-4 h-4" /> Importar desde Falabella
          </DialogTitle>
          <DialogDescription>
            Trae a Synkro lo que ya tienes publicado en Falabella y lo enlaza a tu catálogo.
          </DialogDescription>
        </DialogHeader>

        {!preview && !error && (
          <div className="flex items-center gap-3 py-8 justify-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Leyendo tu catálogo de Falabella…
          </div>
        )}

        {error && <p className="text-sm text-destructive py-4">{error}</p>}

        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-secondary/30 p-3">
                <p className="text-xl font-semibold tabular-nums">{preview.total}</p>
                <p className="text-[11px] text-muted-foreground">En Falabella</p>
              </div>
              <div className="rounded-xl bg-secondary/30 p-3">
                <p className="text-xl font-semibold tabular-nums">{preview.nuevas}</p>
                <p className="text-[11px] text-muted-foreground">Nuevos en Synkro</p>
              </div>
              <div className="rounded-xl bg-secondary/30 p-3">
                <p className="text-xl font-semibold tabular-nums">{preview.yaEnCatalogo}</p>
                <p className="text-[11px] text-muted-foreground">Ya en tu catálogo</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(preview.porEstado).map(([estado, n]) => (
                <Badge key={estado} variant="secondary" className="text-[10px]">
                  {ESTADOS[estado] ?? estado}: {n}
                </Badge>
              ))}
              {preview.notaMedia != null && (
                <Badge variant="secondary" className="text-[10px]">
                  Nota media de calidad: {preview.notaMedia}/100
                </Badge>
              )}
            </div>

            {preview.incompleto && (
              <p className="text-xs text-yellow-400">
                Falabella tiene más publicaciones de las que se pueden leer de una vez. Se importará una parte;
                vuelve a ejecutar la importación para traer el resto.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Los productos nuevos se crean como borradores en tu catálogo. Lo que ya existe no se modifica.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="gradient-primary"
            disabled={!preview || preview.total === 0 || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending ? "Importando…" : `Importar ${preview?.total ?? ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
