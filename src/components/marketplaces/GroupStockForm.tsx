import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { syncApi } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface VarianteDeStock {
  productId: string;
  sku: string;
  etiqueta: string;
  stock: number;
}

/**
 * El stock de TODAS las variantes de un grupo a la vez: una fila por variante, o un mismo número para todas. Solo se envía lo que
 * cambia; con el modo revisión cada cambio queda pendiente de aprobación (una solicitud por cuenta donde esté publicada).
 */
export function GroupStockForm({ variantes, reviewMode, onDone }: { variantes: VarianteDeStock[]; reviewMode: boolean; onDone?: () => void }) {
  const queryClient = useQueryClient();
  const original = useMemo(() => Object.fromEntries(variantes.map((v) => [v.productId, String(v.stock)])), [variantes]);
  const [valores, setValores] = useState<Record<string, string>>(original);
  const [paraTodas, setParaTodas] = useState("");
  useEffect(() => setValores(original), [original]);

  const entero = (t: string) => (t.trim() === "" ? null : Number(t));
  const invalido = (t: string) => { const n = entero(t); return n !== null && (!Number.isInteger(n) || n < 0); };
  const cambios = variantes.filter((v) => valores[v.productId] !== undefined && valores[v.productId] !== original[v.productId] && entero(valores[v.productId]) !== null);
  const hayInvalidos = variantes.some((v) => invalido(valores[v.productId] ?? ""));

  const aplicarATodas = () => {
    if (paraTodas.trim() === "" || invalido(paraTodas)) return;
    setValores(Object.fromEntries(variantes.map((v) => [v.productId, paraTodas.trim()])));
  };

  const guardar = useMutation({
    mutationFn: async () => {
      let enRevision = 0;
      const errores: string[] = [];
      let guardadas = 0;
      for (const v of cambios) {
        const res = await syncApi.updateInventory(v.productId, { stock: Number(valores[v.productId]) });
        if (res.error) errores.push(`${v.etiqueta || v.sku}: ${res.error}`);
        else { guardadas++; enRevision += res.data?.pending ?? 0; }
      }
      return { guardadas, enRevision, errores };
    },
    onSuccess: ({ guardadas, enRevision, errores }) => {
      if (guardadas) {
        toast.success(enRevision
          ? `Stock de ${guardadas} variante(s) en revisión: ${enRevision} solicitud(es) esperan aprobación.`
          : `Stock actualizado en ${guardadas} variante(s).`);
      }
      if (errores.length) toast.error(`${errores.length} no se pudieron guardar: ${errores[0]}`);
      queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
      queryClient.invalidateQueries({ queryKey: ["sync-change-requests"] });
      if (!errores.length) onDone?.();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
        <div className="space-y-1">
          <label htmlFor="stock-todas" className="text-xs font-medium">El mismo stock para todas</label>
          <Input id="stock-todas" type="number" min={0} step={1} className="w-32" value={paraTodas} onChange={(e) => setParaTodas(e.target.value)} placeholder="Ej. 3" />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={aplicarATodas} disabled={paraTodas.trim() === "" || invalido(paraTodas)}>
          Poner en todas
        </Button>
        <p className="text-[11px] text-muted-foreground basis-full">Rellena todas las filas; revisa y pulsa Guardar.</p>
      </div>

      <div className="max-h-[48vh] overflow-y-auto divide-y divide-border/50 rounded-lg border border-border">
        {variantes.map((v) => {
          const malo = invalido(valores[v.productId] ?? "");
          const cambia = valores[v.productId] !== original[v.productId];
          return (
            <div key={v.productId} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{v.etiqueta || v.sku}</p>
                <code className="text-[10px] font-mono text-muted-foreground">{v.sku}</code>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">hoy {v.stock}</span>
              <Input
                aria-label={`Stock de ${v.etiqueta || v.sku}`}
                type="number"
                min={0}
                step={1}
                className={`w-24 ${malo ? "border-red-500" : cambia ? "border-primary" : ""}`}
                value={valores[v.productId] ?? ""}
                onChange={(e) => setValores((prev) => ({ ...prev, [v.productId]: e.target.value }))}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {cambios.length ? `${cambios.length} variante(s) con cambios. ` : "Sin cambios. "}
          {reviewMode ? "Quedarán pendientes hasta que se aprueben." : "Se enviarán de inmediato a los canales."}
        </p>
        <Button className="gradient-primary gap-1.5" disabled={guardar.isPending || !cambios.length || hayInvalidos} onClick={() => guardar.mutate()}>
          {guardar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {reviewMode ? "Enviar a revisión" : "Guardar y sincronizar"}
        </Button>
      </div>
    </div>
  );
}
