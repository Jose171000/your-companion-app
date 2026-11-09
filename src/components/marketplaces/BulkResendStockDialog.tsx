import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RotateCw, Search } from "lucide-react";
import { UserListing, syncApi } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { channelName } from "./format";

/** Lo máximo que acepta el servidor en un envío. */
const MAXIMO = 200;

export interface ReenvioCandidato {
  listing: UserListing;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Publicaciones activas cuyo canal tiene un stock distinto al de Synkro. */
  candidatos: ReenvioCandidato[];
}

const etiquetaDeCanal = (l: UserListing) => `${channelName(l.marketplace)}${l.accountLabel ? ` · ${l.accountLabel}` : ""}`;

/** Elegir a qué productos y canales se les vuelve a mandar el stock de Synkro, y enviarlo de una vez. */
export function BulkResendStockDialog({ open, onOpenChange, candidatos }: Props) {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [canal, setCanal] = useState("todos");
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<{ enviados: number; enRevision: number; omitidos: { listingId: string; motivo: string }[] } | null>(null);

  useEffect(() => {
    if (open) { setBusqueda(""); setCanal("todos"); setElegidos(new Set()); setResultado(null); }
  }, [open]);

  const canales = useMemo(() => [...new Set(candidatos.map((c) => etiquetaDeCanal(c.listing)))].sort(), [candidatos]);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return candidatos.filter(({ listing: l }) =>
      (canal === "todos" || etiquetaDeCanal(l) === canal) &&
      (!q || l.productName.toLowerCase().includes(q) || l.sku.toLowerCase().includes(q)));
  }, [candidatos, busqueda, canal]);

  const idsVisibles = visibles.map((c) => c.listing.id);
  const todosMarcados = idsVisibles.length > 0 && idsVisibles.every((id) => elegidos.has(id));
  const alternar = (id: string) => setElegidos((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const marcarVisibles = () => setElegidos((prev) => {
    const n = new Set(prev);
    if (todosMarcados) idsVisibles.forEach((id) => n.delete(id));
    else idsVisibles.slice(0, MAXIMO).forEach((id) => n.add(id));
    return n;
  });

  const enviar = useMutation({
    mutationFn: () => syncApi.resendListingsStock([...elegidos]),
    onSuccess: (res) => {
      if (res.error || !res.data) { toast.error(res.error ?? "No se pudo reenviar el stock"); return; }
      setResultado(res.data);
      queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
      queryClient.invalidateQueries({ queryKey: ["sync-change-requests"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const porId = useMemo(() => new Map(candidatos.map((c) => [c.listing.id, c.listing])), [candidatos]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reenviar stock a los canales</DialogTitle>
          <DialogDescription>
            Productos cuyo canal tiene un stock distinto al de Synkro. Elige a cuáles les mandas el stock de Synkro. Con el modo revisión encendido quedan pendientes de aprobar.
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3 text-sm">
            {resultado.enviados > 0 && <p className="text-green-500 font-medium">{resultado.enviados} enviado(s) a su canal.</p>}
            {resultado.enRevision > 0 && <p className="text-yellow-400">{resultado.enRevision} quedaron en <b>Revisión</b>: apruébalos allí para que lleguen al canal.</p>}
            {resultado.omitidos.length > 0 && (
              <div className="text-red-400 space-y-0.5">
                <p>{resultado.omitidos.length} se omitieron:</p>
                {resultado.omitidos.slice(0, 12).map((o) => {
                  const l = porId.get(o.listingId);
                  return <p key={o.listingId} className="text-xs">· {l ? `${l.productName} (${etiquetaDeCanal(l)})` : o.listingId}: {o.motivo}</p>;
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar por nombre o SKU…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </div>
              <select
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={canal}
                onChange={(e) => setCanal(e.target.value)}
                aria-label="Canal"
              >
                <option value="todos">Todos los canales</option>
                {canales.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {candidatos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Todos tus canales tienen el mismo stock que Synkro.</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button type="button" className="flex items-center gap-2 hover:text-foreground" onClick={marcarVisibles} disabled={!idsVisibles.length}>
                    <Checkbox checked={todosMarcados} aria-label="Elegir todos los que se ven" />
                    {todosMarcados ? "Quitar los que se ven" : `Elegir los ${Math.min(idsVisibles.length, MAXIMO)} que se ven`}
                  </button>
                  <span>{elegidos.size} elegido(s){elegidos.size >= MAXIMO ? ` · máximo ${MAXIMO}` : ""}</span>
                </div>
                <div className="rounded-lg border border-border divide-y divide-border/50 max-h-[46vh] overflow-y-auto">
                  {visibles.map(({ listing: l }) => (
                    <label key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-secondary/20">
                      <Checkbox
                        checked={elegidos.has(l.id)}
                        onCheckedChange={() => (elegidos.has(l.id) || elegidos.size < MAXIMO) && alternar(l.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{l.productName}</span>
                        <span className="text-[11px] text-muted-foreground">
                          <code className="font-mono">{l.sku}</code> · {etiquetaDeCanal(l)}
                        </span>
                      </span>
                      <span className="text-xs tabular-nums text-right shrink-0">
                        <span className="text-muted-foreground">{l.lastStockSynced ?? "—"} u.</span>
                        <span className="mx-1 text-muted-foreground">→</span>
                        <span className="font-semibold">{l.stock} u.</span>
                      </span>
                    </label>
                  ))}
                  {!visibles.length && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Ninguno coincide con el filtro.</p>}
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{resultado ? "Cerrar" : "Cancelar"}</Button>
          {!resultado && (
            <Button onClick={() => enviar.mutate()} disabled={!elegidos.size || enviar.isPending}>
              {enviar.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCw className="w-4 h-4 mr-2" />}
              Reenviar stock de {elegidos.size} publicación(es)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
