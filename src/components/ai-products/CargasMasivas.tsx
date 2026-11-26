import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, Loader2 } from "lucide-react";
import { bulkUploadApi, CargaMasiva, ProductoDeCarga } from "@/lib/bulk-upload-api";
import { useStores } from "@/contexts/StoreContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const enMarcha = (c: CargaMasiva) => c.estado === "en_cola" || c.estado === "procesando";

const ESTADOS: Record<CargaMasiva["estado"], { texto: string; clase: string }> = {
  en_cola: { texto: "En cola", clase: "bg-secondary text-muted-foreground border-border" },
  procesando: { texto: "Procesando", clase: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  terminada: { texto: "Terminada", clase: "bg-green-500/10 text-green-500 border-green-500/30" },
  detenida: { texto: "Detenida", clase: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
};

const cuando = (fecha: string) =>
  new Date(fecha).toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Las cargas masivas de la tienda: las que están en curso, con su avance, y el historial. Cada una se abre para ver sus
 * productos uno por uno, las filas que no entraron y reintentar lo que falló.
 */
export function CargasMasivas() {
  const { activeStore, can } = useStores();
  const queryClient = useQueryClient();
  const puede = can("productos.editar");
  const { data, isLoading } = useQuery({
    queryKey: ["bulk-batches", activeStore?.id],
    queryFn: () => bulkUploadApi.getBatches(),
    enabled: puede && !!activeStore?.id,
    refetchInterval: (q) => (q.state.data?.data?.cargas?.some(enMarcha) ? 5000 : false),
  });
  const cargas = data?.data?.cargas ?? [];
  const activas = cargas.filter(enMarcha);
  const anteriores = cargas.filter((c) => !enMarcha(c));

  // Cuando una carga deja de estar en curso, la lista de productos se actualiza sola.
  const antes = useRef(0);
  useEffect(() => {
    if (activas.length < antes.current) queryClient.invalidateQueries({ queryKey: ["products"] });
    antes.current = activas.length;
  }, [activas.length, queryClient]);

  if (!puede) return null;

  return (
    <Card className="p-4 md:p-6 rounded-[16px] space-y-4 min-w-0">
      <div>
        <p className="font-semibold text-sm md:text-base">Cargas masivas</p>
        <p className="text-xs text-muted-foreground">Las que subiste en esta tienda. Toca una para ver sus productos.</p>
      </div>

      {data?.error && <p className="text-xs text-red-500">No se pudo leer el historial: {data.error}</p>}
      {isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}
      {!isLoading && !data?.error && cargas.length === 0 && <p className="text-xs text-muted-foreground">Todavía no hay cargas masivas.</p>}

      {activas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">En curso · {activas.length}</p>
          {activas.map((c) => <Carga key={c.id} carga={c} />)}
        </div>
      )}
      {anteriores.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Historial</p>
          {anteriores.map((c) => <Carga key={c.id} carga={c} />)}
        </div>
      )}
    </Card>
  );
}

function Carga({ carga }: { carga: CargaMasiva }) {
  const queryClient = useQueryClient();
  const [abierta, setAbierta] = useState(false);
  const [reintentando, setReintentando] = useState(false);
  const hechos = carga.creados + carga.fallidos + carga.reintentados;
  const porcentaje = carga.total ? Math.min(100, Math.round((hechos / carga.total) * 100)) : 0;
  const { texto, clase } = ESTADOS[carga.estado];
  const f = carga.falabella;
  const Icono = carga.estado === "procesando" ? Loader2 : carga.estado === "en_cola" ? Clock : carga.estado === "detenida" || carga.fallidos ? AlertTriangle : CheckCircle2;

  const reintentar = async () => {
    setReintentando(true);
    const res = await bulkUploadApi.retryProducts(carga.id);
    setReintentando(false);
    if (res.error || !res.data) { toast.error(res.error ?? "No se pudo reintentar la carga"); return; }
    toast.success(res.data.message);
    queryClient.invalidateQueries({ queryKey: ["bulk-batches"] });
  };

  return (
    <div className="rounded-xl border border-border min-w-0">
      <button type="button" aria-expanded={abierta} onClick={() => setAbierta((v) => !v)} className="w-full text-left p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Icono className={cn("w-4 h-4 mt-0.5 shrink-0", carga.estado === "procesando" && "animate-spin text-primary", carga.estado === "terminada" && !carga.fallidos && "text-green-500", (carga.estado === "detenida" || carga.fallidos > 0) && carga.estado !== "procesando" && "text-amber-500")} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{carga.archivo ?? `Carga de ${carga.total} ${carga.total === 1 ? "producto" : "productos"}`}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {cuando(carga.creada)} · {carga.creados} de {carga.total} creados
              {carga.fallidos ? ` · ${carga.fallidos} con error` : ""}
              {carga.rechazadas.length ? ` · ${carga.rechazadas.length} fila(s) no entraron` : ""}
            </p>
          </div>
          <Badge className={cn("text-[10px] shrink-0", clase)}>{texto}</Badge>
          <ChevronDown className={cn("w-4 h-4 mt-0.5 shrink-0 text-muted-foreground transition-transform", abierta && "rotate-180")} />
        </div>
        {carga.estado !== "terminada" && (
          <div className="h-2 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${porcentaje}%` }} />
          </div>
        )}
        {f.enviados + f.pendientes + f.rechazados > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Falabella: {f.enviados} enviados
            {f.pendientes ? ` · ${f.pendientes} esperando envío` : ""}
            {f.rechazados ? ` · ${f.rechazados} rechazados` : ""}
          </p>
        )}
      </button>

      {abierta && (
        <div className="border-t border-border p-3 space-y-3">
          {carga.estado === "detenida" && (
            <p className="text-xs text-amber-500">Lleva un buen rato sin avanzar. Puedes reintentar los que fallaron.</p>
          )}
          {carga.rechazadas.length > 0 && (
            <details className="text-xs text-amber-500">
              <summary className="cursor-pointer">{carga.rechazadas.length} fila(s) del Excel no se cargaron</summary>
              <ul className="mt-1 space-y-0.5 list-disc pl-4 break-words max-h-48 overflow-y-auto">
                {carga.rechazadas.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </details>
          )}
          <Productos carga={carga} />
          {carga.sePuedeReintentar && (
            <div className="flex justify-end">
              <Button size="sm" onClick={reintentar} disabled={reintentando}>{reintentando ? "Reintentando…" : "Reintentar fallidos"}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function resultado(p: ProductoDeCarga) {
  if (p.estado === "fallido") return { texto: "Error", clase: "text-red-500" };
  if (p.estado === "reintentado") return { texto: "Reintentado en otra carga", clase: "text-muted-foreground" };
  if (p.estado === "pendiente") return { texto: "Pendiente", clase: "text-muted-foreground" };
  if (p.falabella === "rechazado") return { texto: "Creado · Falabella lo rechazó", clase: "text-amber-500" };
  if (p.falabella === "pendiente") return { texto: "Creado · esperando envío a Falabella", clase: "text-muted-foreground" };
  if (p.falabella === "enviado") return { texto: "Creado · enviado a Falabella", clase: "text-green-500" };
  return { texto: "Creado", clase: "text-green-500" };
}

function Productos({ carga }: { carga: CargaMasiva }) {
  const [soloProblemas, setSoloProblemas] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["bulk-batches", "productos", carga.id, carga.creados, carga.fallidos, carga.falabella.enviados, carga.falabella.rechazados],
    queryFn: () => bulkUploadApi.getBatchProducts(carga.id),
  });
  if (isLoading) return <p className="text-xs text-muted-foreground">Cargando productos…</p>;
  if (data?.error) return <p className="text-xs text-red-500">{data.error}</p>;
  const todos = data?.data?.productos ?? [];
  const conProblema = todos.filter((p) => p.estado === "fallido" || p.falabella === "rechazado");
  const visibles = soloProblemas ? conProblema : todos;

  return (
    <div className="space-y-2">
      {conProblema.length > 0 && (
        <button type="button" aria-pressed={soloProblemas} onClick={() => setSoloProblemas((v) => !v)} className={cn("h-7 px-3 rounded-full border text-xs", soloProblemas ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}>
          Solo con problemas · {conProblema.length}
        </button>
      )}
      <ul className="divide-y divide-border max-h-80 overflow-y-auto">
        {visibles.map((p) => {
          const r = resultado(p);
          const motivo = p.error || p.falabellaError;
          return (
            <li key={p.sku} className="py-1.5 text-xs">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium break-all">{p.sku}</span>
                <span className={r.clase}>{r.texto}</span>
              </div>
              {motivo && <p className="text-muted-foreground break-words">{motivo}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
