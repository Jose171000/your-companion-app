import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
export function BulkProgressCard({ lote, onClose }: { lote: LoteEnCurso; onClose: () => void }) {
  const queryClient = useQueryClient();
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

      {p?.terminado && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      )}
    </Card>
  );
}
