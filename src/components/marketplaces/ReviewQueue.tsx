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
  isLoading: boolean;
}

const RESOLVED_STYLES: Record<string, { label: string; className: string }> = {
  approved: { label: "Aprobado", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  sent: { label: "Enviado", className: "bg-green-500/10 text-green-400 border-green-500/30" },
  error: { label: "Error", className: "bg-red-500/10 text-red-400 border-red-500/30" },
  rejected: { label: "Rechazado", className: "bg-secondary text-muted-foreground border-border" },
};

const fmtValue = (r: ChangeRequest, v: string | null) =>
  v == null ? "—" : r.field === "price" ? money(v) : `${v} u.`;

function ChangeLine({ r }: { r: ChangeRequest }) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-sm truncate">{r.product.name}</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-0.5">
        <code className="font-mono text-[10px]">{r.product.sku}</code>
        <Badge variant="secondary" className="text-[10px]">
          {channelName(r.marketplace)}
        </Badge>
        <span>{r.field === "price" ? "Precio" : "Stock"}:</span>
        <span className="tabular-nums">{fmtValue(r, r.previousValue)}</span>
        <ArrowRight className="w-3 h-3" />
        <span className="tabular-nums font-semibold text-foreground">{fmtValue(r, r.newValue)}</span>
      </div>
    </div>
  );
}

/** Cola de aprobación: cambios de precio y stock que esperan luz verde. */
export function ReviewQueue({ requests, reviewMode, isLoading }: Props) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-sm">Revisar antes de enviar</p>
          <p className="text-xs text-muted-foreground">
            {reviewMode
              ? "Los cambios de precio y stock esperan tu aprobación antes de llegar a los canales."
              : "Los cambios de precio y stock se envían de inmediato a los canales."}
          </p>
        </div>
        <Switch
          checked={reviewMode}
          disabled={toggle.isPending}
          onCheckedChange={(v) => toggle.mutate(v)}
          aria-label="Modo revisión"
        />
      </div>

      <section className="space-y-3">
        <h3 className="font-semibold text-base">Pendientes ({pending.length})</h3>
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
            {pending.map((r) => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <ChangeLine r={r} />
                <div className="flex gap-2 shrink-0">
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
              </div>
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
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
