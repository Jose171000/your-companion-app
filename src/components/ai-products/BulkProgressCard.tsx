import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { bulkUploadApi } from "@/lib/bulk-upload-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface LoteEnCurso {
  batchId: string;
  /** Filas que se aceptaron al subir el archivo */
  total: number;
  /** Una línea por fila rechazada, con su motivo */
  rechazos: string[];
}

/**
 * Avance de una carga masiva: cuántos productos van listos y cuántos fallaron. Se actualiza solo y avisa cuando termina;
 * mientras tanto el formulario ya está limpio, así que no se puede volver a enviar el mismo archivo por error.
 */
export function BulkProgressCard({ lote, onClose, onNuevoLote }: { lote: LoteEnCurso; onClose: () => void; onNuevoLote: (lote: LoteEnCurso) => void }) {
  const queryClient = useQueryClient();
  const [reintentando, setReintentando] = useState(false);
  const { data, isError } = useQuery({
    queryKey: ["bulk-progress", lote.batchId],
    queryFn: () => bulkUploadApi.getProductsProgress(lote.batchId),
    refetchInterval: (q) => (q.state.data?.data?.terminado ? false : 3000),
    retry: 1,
  });
  const p = data?.data;
  const hechos = (p?.processed ?? 0) + (p?.failed ?? 0);
  const total = p?.total ?? lote.total;
  const porcentaje = total ? Math.min(100, Math.round((hechos / total) * 100)) : 0;

  // Al terminar, la lista de productos se actualiza sola.
  useEffect(() => {
    if (p?.terminado) {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-summary"] });
    }
  }, [p?.terminado, queryClient]);

  const fallidos = p?.fallidos ?? [];
  const rechazadosF = p?.falabellaRechazados ?? [];
  const sinEnviar = p?.falabella?.pendientes ?? 0;
  const hayQueReintentar = !!p?.terminado && (fallidos.length > 0 || sinEnviar > 0);

  const reintentar = async () => {
    setReintentando(true);
    const res = await bulkUploadApi.retryProducts(lote.batchId);
    setReintentando(false);
    if (res.error || !res.data) { toast.error(res.error ?? "No se pudo reintentar la carga"); return; }
    toast.success(res.data.message);
    queryClient.invalidateQueries({ queryKey: ["bulk-progress", lote.batchId] });
    // Los fallidos salen en una carga nueva: la tarjeta pasa a seguir esa.
    if (res.data.batchId) onNuevoLote({ batchId: res.data.batchId, total: res.data.reintentados, rechazos: [] });
  };

  return (
    <Card className="p-4 md:p-6 rounded-[16px] space-y-3 animate-in fade-in duration-300">
      <div className="flex items-start gap-3">
        {p?.terminado ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /> : <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0 mt-0.5" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm md:text-base">
            {p?.terminado ? "Carga masiva terminada" : "Carga masiva en proceso"}
          </p>
          <p className="text-xs text-muted-foreground">
            {p?.terminado
              ? `${p.processed} ${p.processed === 1 ? "producto creado" : "productos creados"}${p.failed ? ` y ${p.failed} con error` : ""}. Ya los puedes ver en Productos.`
              : isError
                ? "No se pudo leer el avance, pero la carga sigue en proceso. Te avisaremos al terminar."
                : "La IA está creando y publicando tus productos. Puedes seguir usando la aplicación; te avisaremos al terminar."}
          </p>
        </div>
      </div>

      <div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${porcentaje}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
          {hechos} de {total} listos{p?.failed ? ` · ${p.failed} con error` : ""}
        </p>
      </div>

      {lote.rechazos.length > 0 && (
        <details className="text-xs text-amber-500">
          <summary className="cursor-pointer">{lote.rechazos.length} fila(s) no se cargaron</summary>
          <ul className="mt-1 space-y-0.5 list-disc pl-4 break-words">
            {lote.rechazos.slice(0, 20).map((r, i) => <li key={i}>{r}</li>)}
            {lote.rechazos.length > 20 && <li>… y {lote.rechazos.length - 20} más</li>}
          </ul>
        </details>
      )}

      {p?.falabella && p.falabella.enviados + p.falabella.pendientes + p.falabella.rechazados > 0 && (
        <p className="text-xs text-muted-foreground tabular-nums">
          Falabella: {p.falabella.enviados} enviados
          {p.falabella.pendientes ? ` · ${p.falabella.pendientes} esperando envío` : ""}
          {p.falabella.rechazados ? ` · ${p.falabella.rechazados} rechazados` : ""}
        </p>
      )}

      {fallidos.length > 0 && (
        <details className="text-xs text-red-500">
          <summary className="cursor-pointer">{fallidos.length} producto(s) no se pudieron crear</summary>
          <ul className="mt-1 space-y-0.5 list-disc pl-4 break-words">
            {fallidos.slice(0, 20).map((f) => <li key={f.sku}>{f.sku}: {f.error}</li>)}
            {fallidos.length > 20 && <li>… y {fallidos.length - 20} más</li>}
          </ul>
        </details>
      )}

      {rechazadosF.length > 0 && (
        <details className="text-xs text-amber-500">
          <summary className="cursor-pointer">{rechazadosF.length} producto(s) rechazados por Falabella</summary>
          <ul className="mt-1 space-y-0.5 list-disc pl-4 break-words">
            {rechazadosF.slice(0, 20).map((f) => <li key={f.sku}>{f.sku}: {f.error}</li>)}
            {rechazadosF.length > 20 && <li>… y {rechazadosF.length - 20} más</li>}
          </ul>
        </details>
      )}

      {p?.terminado && (
        <div className="flex justify-end gap-2">
          {hayQueReintentar && (
            <Button size="sm" onClick={reintentar} disabled={reintentando}>
              {reintentando ? "Reintentando…" : "Reintentar fallidos"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      )}
    </Card>
  );
}
