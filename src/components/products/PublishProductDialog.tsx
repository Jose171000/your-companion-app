import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Product } from "@/lib/products-api";
import { syncApi, FalabellaPrepReport } from "@/lib/sync-api";
import { FalabellaBrandField } from "./FalabellaBrandField";
import { PrepareFalabellaDialog } from "./PrepareFalabellaDialog";
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
import { AlertCircle, Check, ExternalLink, Loader2, Rocket, Sparkles } from "lucide-react";
import { toast } from "sonner";

// Solo Mercado Libre tiene sincronización real por ahora
const PUBLISHABLE = [
  { id: "mercadolibre", name: "MercadoLibre", logo: "/mercadolibre.png" },
  { id: "falabella",    name: "Falabella",    logo: "/Falabella.png" },
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

  // ── Falabella: la IA deja el producto listo (categoría, marca, medidas, datos obligatorios) ──
  const [prep, setPrep] = useState<FalabellaPrepReport | null>(null);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [editarFalabella, setEditarFalabella] = useState(false);
  const [version, setVersion] = useState(0);
  const preparar = useMutation({
    mutationFn: () => syncApi.autoPrepareFalabella(product!.id),
    onSuccess: (res) => {
      if (res.error || !res.data) {
        setPrepError(res.error ?? "No se pudo preparar el producto");
        return;
      }
      setPrepError(null);
      setPrep(res.data);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: () => setPrepError("Error al conectar con el servidor"),
  });
  useEffect(() => {
    setPrep(null);
    setPrepError(null);
  }, [product?.id]);

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
  // Lo que ya está publicado no se vuelve a enviar: Falabella rechazaría el SKU repetido.
  const publicados = new Set(listings.filter((l) => l.syncStatus === "published").map((l) => l.marketplace));
  const porPublicar = selected.filter((id) => !publicados.has(id));

  // Al publicarse un canal sale de la selección.
  useEffect(() => {
    setSelected((prev) => (prev.some((id) => publicados.has(id)) ? prev.filter((id) => !publicados.has(id)) : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings]);

  const publishMutation = useMutation({
    mutationFn: () => syncApi.publish(product!.id, porPublicar),
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

  const falabellaElegido = selected.includes("falabella");
  const falabellaPublicado = listings.find((l) => l.marketplace === "falabella")?.syncStatus === "published";

  // Al elegir Falabella se prepara el producto (y se vuelve a revisar si se editó algo).
  useEffect(() => {
    if (open && falabellaElegido && !falabellaPublicado && isConnected("falabella") && product) preparar.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, falabellaElegido, falabellaPublicado, product?.id, version, connections.length]);

  const canPublish =
    porPublicar.length > 0 &&
    !missingPrice &&
    porPublicar.every((mp) => isConnected(mp)) &&
    (!porPublicar.includes("falabella") || !!prep?.listo) &&
    !publishMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Publicar en marketplaces
          </DialogTitle>
          <DialogDescription className="line-clamp-2 break-words">{product?.name}</DialogDescription>
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
                  "flex items-center justify-between gap-3 p-3 rounded-xl border-2 transition-all min-w-0",
                  isPublished
                    ? "border-green-500/40 bg-green-500/5"
                    : isSelected
                      ? "border-primary bg-primary/10 cursor-pointer"
                      : "border-border bg-card hover:border-primary/50 cursor-pointer"
                )}
                onClick={() => !isPublished && toggle(mp.id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-16 h-10 rounded-[8px] flex items-center justify-center bg-transparent dark:bg-[#EAEAEA] px-2 py-1 shrink-0 overflow-hidden">
                    <img src={mp.logo} alt={mp.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="min-w-0">
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
                      <p className="text-xs text-red-400 break-words line-clamp-3" title={listing.lastError}>
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

          {falabellaElegido && !falabellaPublicado && isConnected("falabella") && (
            <div className="rounded-xl border border-border p-3 space-y-3 min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" /> Datos para Falabella
              </p>

              {preparar.isPending && !prep ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> La IA está preparando categoría, marca y medidas…
                </p>
              ) : prepError ? (
                <p className="text-xs text-red-400 break-words">{prepError}</p>
              ) : prep ? (
                <>
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Categoría</p>
                    {prep.category ? (
                      <p className="text-sm break-words">
                        {prep.category.path}{" "}
                        {prep.category.auto && <Badge className="ml-1 bg-primary/10 text-primary text-[10px]">Elegida por la IA</Badge>}
                      </p>
                    ) : (
                      <p className="text-sm text-red-400">No se pudo elegir una categoría; elígela a mano.</p>
                    )}
                  </div>

                  <FalabellaBrandField
                    productId={product!.id}
                    value={prep.brand.value}
                    onSaved={(brand) => setPrep((p) => (p ? { ...p, brand: { value: brand, replaced: false } } : p))}
                  />
                  {prep.brand.replaced && (
                    <p className="text-[11px] text-amber-500 break-words">
                      «{prep.brand.original}» no existe en Falabella: se usó GENERICO. Busca la marca correcta si quieres cambiarla.
                    </p>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Medidas del paquete</p>
                    <p className="text-sm">
                      {prep.measures.width ?? "?"} × {prep.measures.length ?? "?"} × {prep.measures.height ?? "?"} cm · {prep.measures.weight ?? "?"} kg{" "}
                      {prep.measures.estimated && (
                        <Badge className="ml-1 bg-amber-500/15 text-amber-500 text-[10px]">Estimadas por la IA: revísalas</Badge>
                      )}
                    </p>
                  </div>

                  {prep.estimatedAttributes.length > 0 && (
                    <p className="text-[11px] text-amber-500 break-words">
                      Datos estimados por la IA: {prep.estimatedAttributes.join(", ")}. Revísalos antes de publicar.
                    </p>
                  )}

                  {!prep.listo && prep.motivo && <p className="text-xs text-red-400 break-words">Todavía {prep.motivo}.</p>}

                  <Button variant="outline" size="sm" onClick={() => setEditarFalabella(true)}>
                    Revisar y editar los datos
                  </Button>
                </>
              ) : null}
            </div>
          )}

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
            {porPublicar.length === 0 && publicados.size > 0 ? "Ya publicado" : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <PrepareFalabellaDialog
        product={
          product && prep
            ? ({
                ...product,
                packageWidth: prep.measures.width,
                packageLength: prep.measures.length,
                packageHeight: prep.measures.height,
                packageWeight: prep.measures.weight,
                marketplaceIds: { ...(product.marketplaceIds as any), ...(prep.category ? { falabella_category_id: prep.category.id } : {}) },
                aiAttributes: { ...((product.aiAttributes as any) || {}), brand: prep.brand.value },
              } as Product)
            : product
        }
        open={editarFalabella}
        onClose={() => {
          setEditarFalabella(false);
          setVersion((v) => v + 1); // se vuelve a validar con lo editado
        }}
      />
    </Dialog>
  );
}
