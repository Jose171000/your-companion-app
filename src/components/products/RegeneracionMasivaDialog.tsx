import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, MinusCircle, Sparkles } from "lucide-react";
import { ItemDeRegeneracion, LoteDeRegeneracion, productsApi } from "@/lib/products-api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Cuántos productos (o grupos) caben en una tanda: el servidor lo vuelve a comprobar. */
export const MAX_REGENERACION = 25;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Un id por cada fila seleccionada (un grupo de variantes cuenta como uno) */
  productIds: string[];
  /** Al terminar la tanda, para limpiar la selección */
  onFinished?: () => void;
  /** Una tanda que sigue corriendo: al abrir la ventana se muestra su avance en vez de pedir confirmación */
  loteInicialId?: string | null;
  /** Avisa cuando se lanza una tanda (id) o cuando termina (null) */
  onLote?: (id: string | null) => void;
}

const ESTADO: Record<ItemDeRegeneracion["estado"], { texto: string; clase: string; icono: JSX.Element }> = {
  en_cola: { texto: "En cola", clase: "text-muted-foreground", icono: <CircleDashed className="w-4 h-4" /> },
  generando: { texto: "Generando…", clase: "text-primary", icono: <Loader2 className="w-4 h-4 animate-spin" /> },
  listo: { texto: "Listo", clase: "text-emerald-500", icono: <CheckCircle2 className="w-4 h-4" /> },
  sin_cambios: { texto: "Sin cambios", clase: "text-muted-foreground", icono: <MinusCircle className="w-4 h-4" /> },
  error: { texto: "Error", clase: "text-red-400", icono: <AlertTriangle className="w-4 h-4" /> },
};

/**
 * La IA genera, para los productos seleccionados, lo mismo que «Regenerar con IA» de uno solo, pero SOLO llenando lo que está vacío
 * (ficha HTML, descripción, título, atributos). Un grupo de variantes se genera una sola vez. Se ve el estado de cada uno.
 */
export function RegeneracionMasivaDialog({ open, onOpenChange, productIds, onFinished, loteInicialId, onLote }: Props) {
  const queryClient = useQueryClient();
  const [loteId, setLoteId] = useState<string | null>(null);
  const [inicial, setInicial] = useState<LoteDeRegeneracion | null>(null);
  const [lanzando, setLanzando] = useState(false);
  const [sobrescribir, setSobrescribir] = useState(false);
  const avisado = useRef<string | null>(null);

  useEffect(() => {
    if (open) { setLoteId(loteInicialId ?? null); setInicial(null); avisado.current = null; setSobrescribir(false); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mientras la tanda corre se pregunta cada 3 segundos; al terminar se deja de preguntar.
  const { data, isError } = useQuery({
    queryKey: ["regeneracion-ia", loteId],
    queryFn: async () => {
      const res = await productsApi.regenerationStatus(loteId!);
      if (res.error || !res.data) throw new Error(res.error ?? "No se pudo leer el avance");
      return res.data;
    },
    enabled: !!loteId,
    refetchInterval: (q) => (q.state.data?.terminado ? false : 3000),
    retry: 1,
  });
  // Una tanda que el servidor ya no conoce (p. ej. se reinició): se suelta para poder lanzar otra.
  useEffect(() => {
    if (isError && loteId) { setLoteId(null); setInicial(null); onLote?.(null); }
  }, [isError]); // eslint-disable-line react-hooks/exhaustive-deps
  const lote = data ?? inicial;

  useEffect(() => {
    if (data?.terminado && avisado.current !== data.id) {
      avisado.current = data.id;
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-overview"] });
      queryClient.invalidateQueries({ queryKey: ["product-sheet"] });
      const errores = data.items.filter((i) => i.estado === "error").length;
      toast[errores ? "warning" : "success"](errores ? `Regeneración terminada con ${errores} error(es)` : "Regeneración con IA terminada");
      onLote?.(null);
      onFinished?.();
    }
  }, [data, queryClient, onFinished, onLote]);

  const lanzar = async (ids: string[]) => {
    setLanzando(true);
    const res = await productsApi.regenerateMany({ productIds: ids, sobrescribir });
    setLanzando(false);
    if (res.error || !res.data) { toast.error(res.error ?? "No se pudo iniciar la regeneración"); return; }
    avisado.current = null;
    setInicial(res.data);
    setLoteId(res.data.id);
    onLote?.(res.data.id);
  };

  const fallidos = lote?.items.filter((i) => i.estado === "error") ?? [];
  const progreso = lote ? Math.round((lote.terminados / Math.max(lote.total, 1)) * 100) : 0;
  const demasiados = productIds.length > MAX_REGENERACION;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Generar con IA los productos seleccionados</DialogTitle>
          <DialogDescription>
            La IA redacta la ficha HTML, la descripción y el título que falten y llena los atributos vacíos. <b>Por defecto no cambia nada que ya tenga valor</b> y no envía nada a los canales.
          </DialogDescription>
        </DialogHeader>

        {!lote ? (
          <div className="space-y-3 text-sm min-w-0">
            <p><b>{productIds.length}</b> producto(s) seleccionados. Los productos con variantes se generan una sola vez para todo el grupo.</p>
            {demasiados && (
              <p className="text-red-400 text-xs">El máximo por tanda es {MAX_REGENERACION} productos (un grupo cuenta como uno). Quita {productIds.length - MAX_REGENERACION} de la selección.</p>
            )}
            <label className="flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={sobrescribir} onChange={(e) => setSobrescribir(e.target.checked)} />
              <span className="text-xs"><b>Volver a generar también lo que ya tiene</b><br /><span className="text-muted-foreground">La IA reescribe la ficha HTML, la descripción y el título aunque ya existan; lo anterior se pierde. Sigue sin enviar nada a los canales.</span></span>
            </label>
            {sobrescribir && <p className="text-xs text-amber-500">Se van a sobrescribir los textos de {productIds.length} producto(s).</p>}
            <p className="text-xs text-muted-foreground">Tarda unos minutos: puedes cerrar esta ventana y el trabajo sigue en segundo plano (la lista de productos se actualiza al terminar).</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button className="gradient-primary" disabled={lanzando || demasiados || productIds.length === 0} onClick={() => lanzar(productIds)}>
                {lanzando && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Generar con IA
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3 min-w-0">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{lote.terminados} de {lote.total} terminados</span>
                <span>{lote.terminado ? "Terminó" : "En proceso…"}</span>
              </div>
              <Progress value={progreso} />
            </div>

            <ul className="rounded-lg border border-border divide-y divide-border/50 max-h-80 overflow-y-auto overflow-x-hidden">
              {lote.items.map((i) => {
                const e = ESTADO[i.estado];
                return (
                  <li key={i.clave} className="px-3 py-2 text-sm flex gap-3 min-w-0">
                    <span className={cn("mt-0.5 shrink-0", e.clase)}>{e.icono}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words" title={i.etiqueta}>
                        {i.etiqueta} <code className="text-[10px] text-muted-foreground font-mono">{i.sku}</code>
                        {i.grupoId && <span className="ml-1 text-[10px] text-muted-foreground">· grupo de {i.variantes}</span>}
                      </p>
                      <p className={cn("text-xs break-words", e.clase)}>{e.texto}{i.mensaje ? ` — ${i.mensaje}` : ""}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <DialogFooter className="gap-2">
              {lote.terminado && fallidos.length > 0 && (
                <Button variant="outline" disabled={lanzando} onClick={() => lanzar(fallidos.map((f) => f.productId))}>
                  {lanzando && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Reintentar los {fallidos.length} con error
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)}>{lote.terminado ? "Cerrar" : "Cerrar (sigue en segundo plano)"}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
