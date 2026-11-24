import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crmApi, Lead, LEAD_STAGES, LeadStage } from "@/lib/crm-api";
import { LeadDialog } from "./LeadDialog";
import { ImportLeadsDialog } from "./ImportLeadsDialog";
import { ImportYavendioDialog } from "./ImportYavendioDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Mail, MessageCircle, Phone, Search, Table2, TrendingUp, UserPlus, Users } from "lucide-react";

const money = (n: number) =>
  `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const stageMeta = (id: string) => LEAD_STAGES.find((s) => s.id === id);

export function CrmModule() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("todas");
  const [editing, setEditing] = useState<Lead | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [yavendioOpen, setYavendioOpen] = useState(false);

  const { data: summaryRes, isLoading: loadingSummary } = useQuery({
    queryKey: ["crm-summary"],
    queryFn: () => crmApi.getSummary(),
    staleTime: 20_000,
  });

  const { data: leadsRes, isLoading: loadingLeads } = useQuery({
    queryKey: ["crm-leads", search, stageFilter],
    queryFn: () => crmApi.getLeads(search || undefined, stageFilter === "todas" ? undefined : stageFilter),
    staleTime: 15_000,
  });

  const summary = summaryRes?.data;
  const leads = leadsRes?.data ?? [];

  // Mover de etapa desde la tabla, sin abrir el detalle
  const moveStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => crmApi.update(id, { stage }),
    onSuccess: (res) => {
      if (res.error) return toast.error(res.error);
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      queryClient.invalidateQueries({ queryKey: ["crm-summary"] });
    },
    onError: () => toast.error("No se pudo mover el prospecto"),
  });

  return (
    <div className="space-y-6">
      {/* Resumen del embudo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loadingSummary ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <div className="glass rounded-2xl border border-border dark:border-white/10 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-[#FCCB34]/15 flex items-center justify-center">
                  <Users className="w-4 h-4 text-[#FCCB34]" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Prospectos
                </p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{summary?.total ?? 0}</p>
            </div>

            <div className="glass rounded-2xl border border-border dark:border-white/10 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-[#FCCB34]/15 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#FCCB34]" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pipeline abierto
                </p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{money(summary?.openValue ?? 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Sin contar ganados ni perdidos</p>
            </div>

            <div className="glass rounded-2xl border border-border dark:border-white/10 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ganado
                </p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-green-500">
                {money(summary?.wonValue ?? 0)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Embudo por etapas */}
      {summary && (
        <div className="glass rounded-2xl border border-border dark:border-white/10 p-4 md:p-5">
          <p className="text-sm font-semibold mb-4">Embudo comercial</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {summary.byStage.map((b) => {
              const meta = stageMeta(b.stage);
              const active = stageFilter === b.stage;
              return (
                <button
                  key={b.stage}
                  onClick={() => setStageFilter(active ? "todas" : b.stage)}
                  className={cn(
                    "text-left p-3 rounded-xl border transition-all",
                    active
                      ? "border-[#FCCB34] bg-[#FCCB34]/10"
                      : "border-border hover:border-[#FCCB34]/50"
                  )}
                >
                  <p className="text-xs text-muted-foreground mb-1">{meta?.label}</p>
                  <p className="text-xl font-bold tabular-nums">{b.count}</p>
                  {b.value > 0 && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">{money(b.value)}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra de acciones */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre, empresa, correo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las etapas</SelectItem>
              {LEAD_STAGES.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Table2 className="w-4 h-4 mr-2" />
            Importar CSV
          </Button>
          <Button variant="outline" onClick={() => setYavendioOpen(true)}>
            <MessageCircle className="w-4 h-4 mr-2" />
            Yavendió
          </Button>
          <Button onClick={() => setEditing("new")}>
            <UserPlus className="w-4 h-4 mr-2" />
            Nuevo prospecto
          </Button>
        </div>
      </div>

      {/* Listado */}
      {loadingLeads ? (
        <div className="glass rounded-2xl divide-y divide-border/50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="glass rounded-2xl flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-muted-foreground opacity-50" />
          </div>
          <h3 className="text-base font-semibold mb-1">
            {search || stageFilter !== "todas" ? "Sin resultados" : "Aún no hay prospectos"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {search || stageFilter !== "todas"
              ? "Prueba con otra búsqueda o quita el filtro de etapa."
              : "Importa tu hoja de cálculo o registra el primero a mano."}
          </p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  {["Prospecto", "Contacto", "Origen", "Valor", "Etapa", "Últ. contacto"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {leads.map((l) => (
                  <tr
                    key={l.id}
                    className="hover:bg-secondary/20 transition-colors cursor-pointer"
                    onClick={() => setEditing(l)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{l.name}</p>
                      {l.company && (
                        <p className="text-xs text-muted-foreground">{l.company}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {l.email && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {l.email}
                        </p>
                      )}
                      {l.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {l.phone}
                        </p>
                      )}
                      {!l.email && !l.phone && <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground capitalize">
                        {l.source || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold tabular-nums">
                      {l.estimatedValue ? money(Number(l.estimatedValue)) : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={l.stage}
                        onValueChange={(v) => moveStage.mutate({ id: l.id, stage: v })}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STAGES.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {l.lastContactAt
                        ? new Date(l.lastContactAt).toLocaleDateString("es-PE")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil */}
          <div className="md:hidden divide-y divide-border/50">
            {leads.map((l) => {
              const meta = stageMeta(l.stage);
              return (
                <div key={l.id} className="p-4 space-y-2" onClick={() => setEditing(l)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{l.name}</p>
                      {l.company && (
                        <p className="text-xs text-muted-foreground">{l.company}</p>
                      )}
                    </div>
                    <Badge className={cn("text-[10px] shrink-0", meta?.color)}>{meta?.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{l.email || l.phone || "sin contacto"}</span>
                    {l.estimatedValue && (
                      <span className="font-semibold tabular-nums">
                        {money(Number(l.estimatedValue))}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <LeadDialog lead={editing} onClose={() => setEditing(null)} />
      <ImportLeadsDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <ImportYavendioDialog open={yavendioOpen} onClose={() => setYavendioOpen(false)} />
    </div>
  );
}
