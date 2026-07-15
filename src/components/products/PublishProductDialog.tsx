import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Product } from "@/lib/products-api";
import { syncApi } from "@/lib/sync-api";
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
import { cn } from "@/lib/utils";
import { AlertCircle, Check, ExternalLink, Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";

// Solo Mercado Libre tiene sincronización real por ahora
const PUBLISHABLE = [
  { id: "mercadolibre", name: "MercadoLibre", logo: "/mercadolibre.png" },
];

interface PublishProductDialogProps {
  product: Product | null;
  onClose: () => void;
}

export function PublishProductDialog({ product, onClose }: PublishProductDialogProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>(["mercadolibre"]);

  useEffect(() => {
    if (product) setSelected(["mercadolibre"]);
  }, [product]);

  const open = product !== null;

  // ── Estado actual de sincronización del producto ───────────────────────────
  const { data: statusResult } = useQuery({
    queryKey: ["sync-status", product?.id],
    queryFn:  () => syncApi.getProductStatus(product!.id),
    enabled:  open,
    refetchInterval: open ? 5_000 : false, // la publicación es asíncrona
  });

  // ── Conexiones (para avisar si falta conectar la cuenta) ───────────────────
  const { data: connectionsResult } = useQuery({
    queryKey: ["sync-connections"],
    queryFn:  () => syncApi.getConnections(),
    enabled:  open,
    staleTime: 30_000,
  });

  const listings    = statusResult?.data?.listings ?? [];
  const connections = connectionsResult?.data ?? [];
  const missingPrice = product?.price == null;

  const listingFor = (marketplace: string) =>
    listings.find((l) => l.marketplace === marketplace);

  const isConnected = (marketplace: string) =>
    connections.some((c) => c.marketplace === marketplace && c.status === "active");

  // ── Publicar ───────────────────────────────────────────────────────────────
  const publishMutation = useMutation({
    mutationFn: () => syncApi.publish(product!.id, selected),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Publicación encolada — el estado se actualiza en unos segundos");
      queryClient.invalidateQueries({ queryKey: ["sync-status", product?.id] });
      queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const canPublish =
    selected.length > 0 &&
    !missingPrice &&
    selected.every((mp) => isConnected(mp)) &&
    !publishMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Publicar en marketplaces
          </DialogTitle>
          <DialogDescription className="truncate">{product?.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {PUBLISHABLE.map((mp) => {
            const listing   = listingFor(mp.id);
            const connected = isConnected(mp.id);
            const isSelected = selected.includes(mp.id);
            const isPublished = listing?.syncStatus === "published";

            return (
              <div
                key={mp.id}
                className={cn(
                  "flex items-center justify-between gap-3 p-3 rounded-xl border-2 transition-all",
                  isPublished
                    ? "border-green-500/40 bg-green-500/5"
                    : isSelected
                      ? "border-primary bg-primary/10 cursor-pointer"
                      : "border-border bg-card hover:border-primary/50 cursor-pointer"
                )}
                onClick={() => !isPublished && toggle(mp.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-16 h-10 rounded-[8px] flex items-center justify-center bg-transparent dark:bg-[#EAEAEA] px-2 py-1 shrink-0 overflow-hidden">
                    <img src={mp.logo} alt={mp.name} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{mp.name}</p>
                    {isPublished && listing?.permalink ? (
                      <a
                        href={listing.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Ver publicación <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : !connected ? (
                      <p className="text-xs text-yellow-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Conecta tu cuenta en Marketplaces
                      </p>
                    ) : listing?.syncStatus === "error" ? (
                      <p className="text-xs text-red-400 truncate max-w-[200px]" title={listing.lastError}>
                        {listing.lastError || "Error al publicar"}
                      </p>
                    ) : listing?.syncStatus === "pending" ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Publicando…
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Listo para publicar</p>
                    )}
                  </div>
                </div>

                {isPublished ? (
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[10px]">
                    Publicado
                  </Badge>
                ) : (
                  isSelected && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )
                )}
              </div>
            );
          })}

          {missingPrice && (
            <p className="text-xs text-yellow-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              El producto necesita un precio antes de publicarse. Edítalo primero.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={() => publishMutation.mutate()} disabled={!canPublish}>
            {publishMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4 mr-2" />
            )}
            Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
