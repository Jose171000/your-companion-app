import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Check, X } from "lucide-react";
import { ChangeRequest, syncApi } from "@/lib/sync-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { channelName, money } from "./format";

interface Props {
  requests: ChangeRequest[];
  reviewMode: boolean;
  /** Solo el dueño aprueba, rechaza y cambia el modo revisión */
  canManage: boolean;
  isLoading: boolean;
  /** Solo estos campos («stock», «price», «promo»); sin esto salen todos. */
  campos?: string[];
  /** Dentro del Tablero: solo la lista de pendientes, sin el interruptor ni el historial, y nada si no hay pendientes. */
  compacto?: boolean;
  titulo?: string;
}

const RESOLVED_STYLES: Record<string, { label: string; className: string }> = {
  approved: { label: "Aprobado", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  sent: { label: "Enviado", className: "bg-green-500/10 text-green-400 border-green-500/30" },
  error: { label: "Error", className: "bg-red-500/10 text-red-400 border-red-500/30" },
  skipped: { label: "No enviado", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  rejected: { label: "Rechazado", className: "bg-secondary text-muted-foreground border-border" },
};

const fmtFecha = (d: string) => d.split("-").reverse().join("/");

/** «120|2026-11-09|2027-01-31» → «S/ 120.00 (09/11/2026 → 31/01/2027)»; «quitar» o vacío → «Sin descuento». */
function fmtDescuento(v: string | null) {
  if (v == null || v === "" || v === "quitar") return "Sin descuento";
  const [precio, desde, hasta] = v.split("|");
  const fechas = desde || hasta ? ` (${desde ? fmtFecha(desde) : "…"} → ${hasta ? fmtFecha(hasta) : "…"})` : "";
  return `${money(precio)}${fechas}`;
}

const fmtValue = (r: ChangeRequest, v: string | null) =>
  r.field === "promo" ? fmtDescuento(v) : v == null ? "—" : r.field === "price" ? money(v) : `${v} u.`;

function ChangeLine({ r }: { r: ChangeRequest }) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-sm truncate">{r.product.name}</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-0.5">
        <code className="font-mono text-[10px]">{r.product.sku}</code>
        <Badge variant="secondary" className="text-[10px]">
          {channelName(r.marketplace)}
          {(r.connection?.label || r.connection?.externalNickname) && ` · ${r.connection?.label || r.connection?.externalNickname}`}
        </Badge>
        <span>{r.field === "price" ? "Precio" : r.field === "promo" ? "Descuento" : "Stock"}:</span>
        <span className="tabular-nums">{fmtValue(r, r.previousValue)}</span>
        <ArrowRight className="w-3 h-3" />
        <span className="tabular-nums font-semibold text-foreground">{fmtValue(r, r.newValue)}</span>
      </div>
    </div>
  );
}

/**
 * Las solicitudes de un mismo grupo de variantes con el mismo cambio (mismo campo, cuenta y valor nuevo) se muestran juntas:
 * «Sandalias… · 20 variantes · S/ 200 → S/ 220», con un solo botón para aprobarlas o rechazarlas.
 */
interface Lote { clave: string; solicitudes: ChangeRequest[] }
function agrupar(pendientes: ChangeRequest[]): Lote[] {
  const mapa = new Map<string, ChangeRequest[]>();
  const orden: string[] = [];
  for (const r of pendientes) {
    const g = r.product.group?.id;
    const clave = g ? `g|${g}|${r.field}|${r.connection?.id ?? r.marketplace}|${r.newValue}` : `s|${r.id}`;
    if (!mapa.has(clave)) { mapa.set(clave, []); orden.push(clave); }
    mapa.get(clave)!.push(r);
  }
  return orden.map((clave) => ({ clave, solicitudes: mapa.get(clave)! }));
}

const ETIQUETA_DE_CAMPO: Record<string, string> = { price: "Precio", stock: "Stock", promo: "Descuento" };

function LoteDeSolicitudes({
  lote, abierto, onToggle, canManage, ocupado, onAprobar, onRechazar,
}: { lote: Lote; abierto: boolean; onToggle: () => void; canManage: boolean; ocupado: boolean; onAprobar: () => void; onRechazar: () => void }) {
  const r0 = lote.solicitudes[0];
  const n = lote.solicitudes.length;
  const anteriores = new Set(lote.solicitudes.map((r) => r.previousValue));
  const cuenta = r0.connection?.label || r0.connection?.externalNickname;
  return (
    <div>
      <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{r0.product.group?.name}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-0.5">
            <Badge variant="secondary" className="text-[10px]">{n} variantes</Badge>
            <Badge variant="secondary" className="text-[10px]">{channelName(r0.marketplace)}{cuenta ? ` · ${cuenta}` : ""}</Badge>
            <span>{ETIQUETA_DE_CAMPO[r0.field] ?? r0.field}:</span>
            <span className="tabular-nums">{anteriores.size === 1 ? fmtValue(r0, r0.previousValue) : "varios valores"}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="tabular-nums font-semibold text-foreground">{fmtValue(r0, r0.newValue)}</span>
            <button type="button" className="text-primary hover:underline" onClick={onToggle}>{abierto ? "Ocultar detalle" : "Ver detalle"}</button>
          </div>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2 sm:shrink-0 max-w-full">
            <Button variant="outline" size="sm" className="gap-1.5" disabled={ocupado} onClick={onRechazar}><X className="w-3.5 h-3.5" /> Rechazar las {n}</Button>
            <Button size="sm" className="gap-1.5 gradient-primary" disabled={ocupado} onClick={onAprobar}><Check className="w-3.5 h-3.5" /> Aprobar las {n}</Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground shrink-0">Espera la aprobación del dueño</span>
        )}
      </div>
      {abierto && (
        <div className="bg-secondary/10 border-t border-border/50 divide-y divide-border/40 pl-6">
          {lote.solicitudes.map((r) => <div key={r.id} className="px-4 py-2"><ChangeLine r={r} /></div>)}
        </div>
      )}
    </div>
  );
}

/** Cola de aprobación: cambios de precio y stock que esperan luz verde. */
export function ReviewQueue({ requests: todas, reviewMode, canManage, isLoading, campos, compacto, titulo }: Props) {
  const requests = campos ? todas.filter((r) => campos.includes(r.field)) : todas;
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [confirmarTodas, setConfirmarTodas] = useState(false);
  const alternar = (clave: string) => setAbiertos((prev) => { const n = new Set(prev); if (n.has(clave)) n.delete(clave); else n.add(clave); return n; });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["sync-change-requests"] });
    queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
  };

  const approve = useMutation({
    mutationFn: (id: string) => syncApi.approveChange(id),
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: (res) => {
      if (res.error) toast.error(res.error);
      else toast.success(res.data?.message ?? "Cambio aprobado");
      refresh();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const reject = useMutation({
    mutationFn: (id: string) => syncApi.rejectChange(id),
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: (res) => {
      if (res.error) toast.error(res.error);
      else toast.success("Cambio rechazado");
      refresh();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  // Varias a la vez: un lote de variantes o todas las pendientes (el servidor admite hasta 200).
  const aprobarVarias = useMutation({
    mutationFn: (ids: string[]) => syncApi.approveManyChanges(ids.slice(0, 200)),
    onMutate: () => setBusyId("__varias__"),
    onSettled: () => { setBusyId(null); setConfirmarTodas(false); },
    onSuccess: (res) => {
      if (res.error || !res.data) toast.error(res.error ?? "No se pudieron aprobar");
      else {
        toast.success(`${res.data.aprobadas} cambio(s) aprobados; se envían a los canales.`);
        if (res.data.omitidas.length) toast.error(`${res.data.omitidas.length} no se pudieron aprobar: ${res.data.omitidas[0].motivo}`);
      }
      refresh();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const rechazarVarias = useMutation({
    mutationFn: (ids: string[]) => syncApi.rejectManyChanges(ids.slice(0, 200)),
    onMutate: () => setBusyId("__varias__"),
    onSettled: () => setBusyId(null),
    onSuccess: (res) => {
      if (res.error || !res.data) toast.error(res.error ?? "No se pudieron rechazar");
      else toast.success(`${res.data.rechazadas} cambio(s) rechazados`);
      refresh();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => syncApi.setReviewMode(enabled),
    onSuccess: (res) => {
      if (res.error) toast.error(res.error);
      else
        toast.success(
          res.data?.reviewMode
            ? "Modo revisión activado"
            : "Modo revisión apagado: los cambios se envían directo",
        );
      queryClient.invalidateQueries({ queryKey: ["sync-settings"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const pending = requests.filter((r) => r.status === "pending");
  const history = requests.filter((r) => r.status !== "pending");
  const lotes = agrupar(pending);

  // Dentro del Tablero no se muestra nada hasta que haya algo por aprobar.
  if (compacto && !isLoading && !pending.length) return null;

  return (
    <div className="space-y-6">
      {!compacto && (
      <div className="glass rounded-2xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-sm">Revisar antes de enviar</p>
          <p className="text-xs text-muted-foreground">
            {reviewMode
              ? "Los cambios de precio y stock esperan tu aprobación antes de llegar a los canales."
              : "Los cambios de precio y stock se envían de inmediato a los canales."}
            {!canManage && " Solo el dueño de la tienda puede cambiarlo."}
          </p>
        </div>
        <Switch
          checked={reviewMode}
          disabled={toggle.isPending || !canManage}
          onCheckedChange={(v) => toggle.mutate(v)}
          aria-label="Modo revisión"
        />
      </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold text-base">{titulo ?? "Pendientes"} ({pending.length})</h3>
          {canManage && pending.length > 1 && (
            confirmarTodas ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">¿Aprobar las {Math.min(pending.length, 200)} pendientes y enviarlas a los canales?</span>
                <Button variant="outline" size="sm" onClick={() => setConfirmarTodas(false)} disabled={busyId === "__varias__"}>No</Button>
                <Button size="sm" className="gap-1.5 gradient-primary" disabled={busyId === "__varias__"} onClick={() => aprobarVarias.mutate(pending.map((r) => r.id))}>
                  <Check className="w-3.5 h-3.5" /> Sí, aprobar
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConfirmarTodas(true)}>
                <Check className="w-3.5 h-3.5" /> Aprobar todas ({pending.length})
              </Button>
            )
          )}
        </div>
        {isLoading ? (
          <div className="glass rounded-2xl p-4 space-y-3">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
        ) : !pending.length ? (
          <div className="glass rounded-2xl py-12 text-center">
            <p className="text-sm font-medium">No hay cambios por revisar</p>
            <p className="text-xs text-muted-foreground mt-1">Cuando edites un precio o stock aparecerá aquí.</p>
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden divide-y divide-border/50">
            {lotes.map((lote) => lote.solicitudes.length > 1 ? (
              <LoteDeSolicitudes
                key={lote.clave}
                lote={lote}
                abierto={abiertos.has(lote.clave)}
                onToggle={() => alternar(lote.clave)}
                canManage={canManage}
                ocupado={busyId === "__varias__"}
                onAprobar={() => aprobarVarias.mutate(lote.solicitudes.map((r) => r.id))}
                onRechazar={() => rechazarVarias.mutate(lote.solicitudes.map((r) => r.id))}
              />
            ) : lote.solicitudes.map((r) => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <ChangeLine r={r} />
                {canManage ? (
                <div className="flex flex-wrap gap-2 sm:shrink-0 max-w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={busyId === r.id}
                    onClick={() => reject.mutate(r.id)}
                  >
                    <X className="w-3.5 h-3.5" /> Rechazar
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 gradient-primary"
                    disabled={busyId === r.id}
                    onClick={() => approve.mutate(r.id)}
                  >
                    <Check className="w-3.5 h-3.5" /> Aprobar
                  </Button>
                </div>
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0">Espera la aprobación del dueño</span>
                )}
              </div>
            )))}
          </div>
        )}
      </section>

      {!compacto && history.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold text-base">Historial</h3>
          <div className="glass rounded-2xl overflow-hidden divide-y divide-border/50">
            {history.map((r) => {
              const style = RESOLVED_STYLES[r.status] ?? RESOLVED_STYLES.rejected;
              return (
                <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <div className="min-w-0 space-y-1">
                    <ChangeLine r={r} />
                    {r.resultMessage && <p className="text-xs text-muted-foreground">{r.resultMessage}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    {r.resolvedAt && <span>{new Date(r.resolvedAt).toLocaleString()}</span>}
                    <Badge className={cn("text-[10px]", style.className)}>{style.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
