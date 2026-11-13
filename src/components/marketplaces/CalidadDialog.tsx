import { AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Calidad } from "./calidad";
import { MejorasDeCalidad } from "./mejoras";

export interface CalidadAbierta {
  nombre: string;
  /** «3 variantes» cuando es un grupo. */
  detalle?: string;
  calidad: Calidad;
  mejoras: MejorasDeCalidad;
}

const colorDe = (p: number) => (p >= 80 ? "text-green-400" : p >= 50 ? "text-yellow-400" : "text-red-400");

/** Qué le falta a un producto para llegar al 100 %: cuenta por cuenta, con lo que hay que hacer. */
export function CalidadDialog({ abierta, onClose }: { abierta: CalidadAbierta | null; onClose: () => void }) {
  const c = abierta?.calidad;
  return (
    <Dialog open={abierta !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>{c && c.porcentaje >= 100 ? "Calidad al 100 %" : "Cómo llegar al 100 % de calidad"}</DialogTitle>
          <DialogDescription className="break-words">
            {abierta?.nombre}{abierta?.detalle ? ` · ${abierta.detalle}` : ""}
          </DialogDescription>
        </DialogHeader>

        {abierta && c && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className={cn("text-3xl font-bold tabular-nums", colorDe(c.porcentaje))}>{c.porcentaje}%</span>
                <span className="text-xs text-muted-foreground text-right">Activo en {c.activas} de {c.total} cuentas conectadas</span>
              </div>
              <Progress value={c.porcentaje} className="h-2" />
            </div>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Por cuenta</h4>
              <ul className="space-y-2">
                {abierta.mejoras.cuentas.map((cu) => {
                  const completa = cu.activas === cu.total;
                  return (
                    <li key={cu.cuenta} className="rounded-xl border border-border bg-secondary/20 p-3 space-y-1.5">
                      <div className="flex items-start gap-2">
                        {completa ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-400" /> : <Circle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-400" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium break-words">{cu.cuenta}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {completa ? (cu.total > 1 ? `Las ${cu.total} variantes están activas` : "Activo") : `${cu.activas} de ${cu.total} ${cu.total > 1 ? "variantes activas" : "activo"}`}
                          </p>
                        </div>
                      </div>
                      {cu.pasos.map((p) => (
                        <p key={p.estado} className="text-xs text-muted-foreground pl-6 break-words">{p.texto}</p>
                      ))}
                    </li>
                  );
                })}
                {!abierta.mejoras.cuentas.length && (
                  <li className="text-xs text-muted-foreground">Todavía no hay cuentas de canal conectadas. Conecta una en la pestaña Canales.</li>
                )}
              </ul>
            </section>

            {abierta.mejoras.avisos.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Otros avisos</h4>
                <p className="text-[11px] text-muted-foreground -mt-1">No cambian el porcentaje, pero conviene resolverlos.</p>
                <ul className="space-y-1.5">
                  {abierta.mejoras.avisos.map((a) => (
                    <li key={a} className="flex items-start gap-2 text-xs break-words">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-400" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
