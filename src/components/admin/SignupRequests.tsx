import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, SignupRequest } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, Loader2, X, Globe, Phone, Building2, FileText } from "lucide-react";

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });

function Dato({ icon: Icon, children }: { icon: typeof Globe; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {children}
    </span>
  );
}

export function SignupRequests() {
  const queryClient = useQueryClient();
  const [verRechazadas, setVerRechazadas] = useState(false);
  const [rechazando, setRechazando] = useState<SignupRequest | null>(null);
  const [motivo, setMotivo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-signups", verRechazadas ? "rejected" : "pending"],
    queryFn: () => adminApi.getSignups(verRechazadas ? "rejected" : "pending"),
  });

  const lista = data?.data?.solicitudes ?? [];
  const conteo = data?.data?.conteo;

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-signups"] });
    queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    queryClient.invalidateQueries({ queryKey: ["stores"] });
  };

  const aprobar = useMutation({
    mutationFn: (id: string) => adminApi.approveSignup(id),
    onSuccess: (res) => {
      if (res.error) return toast.error(res.error);
      toast.success(res.data?.message ?? "Cuenta aprobada");
      refrescar();
    },
    onError: () => toast.error("No se pudo aprobar la cuenta"),
  });

  const rechazar = useMutation({
    mutationFn: () => adminApi.rejectSignup(rechazando!.id, motivo.trim() || undefined),
    onSuccess: (res) => {
      if (res.error) return toast.error(res.error);
      toast.success(res.data?.message ?? "Solicitud rechazada");
      setRechazando(null);
      setMotivo("");
      refrescar();
    },
    onError: () => toast.error("No se pudo rechazar la solicitud"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Quien se registra queda en espera hasta que revises sus datos. Al aprobar se crea su tienda y se le avisa por correo.
        </p>
        <Button variant="outline" size="sm" onClick={() => setVerRechazadas((v) => !v)}>
          {verRechazadas
            ? "Ver pendientes"
            : `Ver rechazadas${conteo ? ` (${conteo.rechazadas})` : ""}`}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {verRechazadas ? "No hay solicitudes rechazadas." : "No hay solicitudes pendientes."}
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((s) => (
            <div key={s.id} className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-base">{s.tienda || "Sin nombre de tienda"}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.nombre} · {s.email}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{fecha(s.fecha)}</span>
                  {s.estado === "rejected" && <Badge variant="destructive">Rechazada</Badge>}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                <Dato icon={Building2}>{s.razonSocial || "Sin razón social"}</Dato>
                <Dato icon={FileText}>RUC {s.ruc || "—"}</Dato>
                {s.web && <Dato icon={Globe}>{s.web}</Dato>}
                {s.telefono && <Dato icon={Phone}>{s.telefono}</Dato>}
              </div>

              {s.estado === "rejected" && s.motivo && (
                <p className="text-sm text-muted-foreground">Motivo: {s.motivo}</p>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <Button
                  size="sm"
                  onClick={() => aprobar.mutate(s.id)}
                  disabled={aprobar.isPending}
                  className="bg-[#FCCB34] text-[#111111] hover:bg-[#F5B800]"
                >
                  {aprobar.isPending && aprobar.variables === s.id ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-1.5" />
                  )}
                  {s.estado === "rejected" ? "Aprobar ahora" : "Aprobar"}
                </Button>
                {s.estado === "pending" && (
                  <Button size="sm" variant="outline" onClick={() => setRechazando(s)}>
                    <X className="w-4 h-4 mr-1.5" />
                    Rechazar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={rechazando !== null} onOpenChange={(o) => !o && setRechazando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
            <DialogDescription>
              {rechazando?.tienda} ({rechazando?.email}) recibirá un correo. El motivo es opcional pero ayuda a que pueda corregir sus datos.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. No pudimos validar el RUC con la razón social indicada."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazando(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => rechazar.mutate()} disabled={rechazar.isPending}>
              {rechazar.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Rechazar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
