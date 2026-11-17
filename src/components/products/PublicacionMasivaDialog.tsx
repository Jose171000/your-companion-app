import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Rocket } from "lucide-react";
import { ResultadoPublicacionMasiva, VistaPublicacionMasiva, syncApi } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productIds: string[];
  vista: VistaPublicacionMasiva | null;
  cargando: boolean;
  error: boolean;
}

/**
 * Publicar de forma masiva: la persona elige en qué cuentas conectadas publicar los productos seleccionados que aún no están ahí.
 * Lo ya publicado se salta; lo que no está listo (sin precio, fotos o categoría de Falabella) se muestra con su motivo y no se envía.
 */
export function PublicacionMasivaDialog({ open, onOpenChange, productIds, vista, cargando, error }: Props) {
  const queryClient = useQueryClient();
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [confirmo, setConfirmo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPublicacionMasiva | null>(null);

  useEffect(() => {
    if (open) { setElegidas([]); setConfirmo(false); setResultado(null); }
  }, [open]);

  const publicar = useMutation({
    mutationFn: async () => {
      const res = await syncApi.bulkPublish(productIds, elegidas);
      if (res.error || !res.data) throw new Error(res.error ?? "No se pudo iniciar la publicación");
      return res.data;
    },
    onSuccess: (r) => {
      setResultado(r);
      toast[r.encoladas.length ? "success" : "warning"](r.message);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
      queryClient.invalidateQueries({ queryKey: ["publicacion-masiva-vista"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternar = (id: string) => setElegidas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const cuentas = vista?.cuentas ?? [];
  const listosEnElegidas = elegidas.reduce((n, id) => n + (cuentas.find((c) => c.id === id)?.listos ?? 0), 0);
  const noListos = (vista?.productos ?? []).flatMap((p) =>
    elegidas.flatMap((id) => {
      const r = p.cuentas[id];
      const c = cuentas.find((x) => x.id === id);
      return r?.estado === "incompleto" && c ? [{ clave: `${p.clave}:${id}`, producto: p.etiqueta, cuenta: `${c.canal}${c.cuenta ? ` · ${c.cuenta}` : ""}`, motivos: r.incompletas }] : [];
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Rocket className="w-4 h-4" /> Publicar en canales los productos seleccionados</DialogTitle>
          <DialogDescription>
            Elige las cuentas donde publicar. Solo se envían los productos que aún no están en ellas y que están listos; un producto con variantes se publica entero.
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {resultado.message}</p>
            {resultado.encoladas.length > 0 && (
              <ul className="rounded-lg border border-border divide-y divide-border/50 max-h-52 overflow-y-auto">
                {resultado.encoladas.map((e, i) => (
                  <li key={i} className="px-3 py-2 text-xs"><b className="break-words">{e.producto}</b> → {e.cuenta} <span className="text-muted-foreground">({e.variantes} {e.variantes === 1 ? "variante" : "variantes"})</span></li>
                ))}
              </ul>
            )}
            {resultado.omitidas.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-500">No se enviaron ({resultado.omitidas.length}):</p>
                <ul className="rounded-lg border border-border divide-y divide-border/50 max-h-52 overflow-y-auto">
                  {resultado.omitidas.map((o, i) => (
                    <li key={i} className="px-3 py-2 text-xs"><b className="break-words">{o.producto}</b> · {o.cuenta}<br /><span className="text-muted-foreground break-words">{o.motivo}</span></li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Los canales procesan en segundo plano: el estado de cada publicación pasa de «En proceso» a «Publicado» (o «Error», con su motivo) en unos minutos.</p>
            <DialogFooter><Button onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter>
          </div>
        ) : cargando ? (
          <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
        ) : error || !vista ? (
          <p className="text-sm text-destructive">No se pudo revisar qué le falta a los productos seleccionados. Cierra e inténtalo de nuevo.</p>
        ) : (
          <div className="space-y-4 text-sm">
            <p><b>{vista.total}</b> producto(s) seleccionados (un grupo de variantes cuenta como uno).</p>

            <div className="space-y-2">
              {cuentas.length === 0 && <p className="text-muted-foreground">No hay cuentas de canales conectadas en esta tienda.</p>}
              {cuentas.map((c) => {
                const deshabilitada = !c.soportada || c.faltan === 0;
                return (
                  <label key={c.id} className={`flex items-start gap-3 rounded-lg border border-border p-3 ${deshabilitada ? "opacity-60" : "cursor-pointer hover:border-primary/50"}`}>
                    <input type="checkbox" className="mt-1" disabled={deshabilitada} checked={elegidas.includes(c.id)} onChange={() => alternar(c.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium break-words">{c.canal}{c.cuenta ? ` · ${c.cuenta}` : ""}</span>
                      <span className="block text-xs text-muted-foreground">
                        {!c.soportada
                          ? c.motivoNoDisponible
                          : c.faltan === 0
                            ? "Los productos seleccionados ya están publicados (o en proceso) aquí."
                            : `Faltan ${c.faltan} de ${vista.total} · ${c.listos} listo(s) para enviar${c.faltan - c.listos > 0 ? ` · ${c.faltan - c.listos} con algo pendiente` : ""}`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {noListos.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-500"><AlertTriangle className="w-3.5 h-3.5" /> No están listos y no se enviarán ({noListos.length}):</p>
                <ul className="rounded-lg border border-border divide-y divide-border/50 max-h-44 overflow-y-auto">
                  {noListos.map((n) => (
                    <li key={n.clave} className="px-3 py-2 text-xs">
                      <b className="break-words">{n.producto}</b> · {n.cuenta}
                      <br /><span className="text-muted-foreground break-words">{n.motivos.slice(0, 3).map((m) => `${m.sku}: ${m.motivos.join(", ")}`).join(" — ")}{n.motivos.length > 3 ? "…" : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {elegidas.length > 0 && (
              <label className="flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer text-xs">
                <input type="checkbox" className="mt-0.5" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} />
                <span>Entiendo que esto <b>publica en canales reales</b>: se enviarán {listosEnElegidas} producto(s) listo(s) a {elegidas.length} cuenta(s).</span>
              </label>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button className="gradient-primary" disabled={!elegidas.length || !confirmo || listosEnElegidas === 0 || publicar.isPending} onClick={() => publicar.mutate()}>
                {publicar.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5 mr-1.5" />} Publicar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
