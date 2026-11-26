import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Check, Search, X } from "lucide-react";
import { ChangeRequest, syncApi } from "@/lib/sync-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/**
 * «120|2026-11-09|2027-01-31» → «S/ 120.00 (09/11/2026 → 31/01/2027)»; «quitar» o vacío → «Sin descuento».
 * Un «|g» al final marca el descuento GENERAL del producto («quitar|g», «120|…|g»): no es un dato más y se ignora al mostrarlo.
 */
function fmtDescuento(valor: string | null) {
  const v = valor != null && valor.endsWith("|g") ? valor.slice(0, -2) : valor;
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

const CAMPOS = [
  { valor: "", etiqueta: "Todo (precio, descuento, stock)" },
  { valor: "price", etiqueta: "Precio" },
  { valor: "promo", etiqueta: "Descuento" },
  { valor: "stock", etiqueta: "Stock" },
];
const clasesDeFiltro = "h-9 rounded-md border border-border bg-background px-2 text-sm";

/** Buscador por SKU o nombre y filtro por tipo de cambio, comunes a Pendientes e Historial. */
function Filtros({ q, onQ, campo, onCampo, children }: { q: string; onQ: (v: string) => void; campo: string; onCampo: (v: string) => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => onQ(e.target.value)} placeholder="Buscar por SKU o nombre…" className="pl-8 h-9" />
      </div>
      <select value={campo} onChange={(e) => onCampo(e.target.value)} className={clasesDeFiltro} aria-label="Filtrar por tipo de cambio">
        {CAMPOS.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
      </select>
      {children}
    </div>
  );
}

/** Todo lo ya resuelto, con páginas, búsqueda y filtro por estado: el estado real de cada envío. */
function HistorialDeSolicitudes({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [pagina, setPagina] = useState(1);
  const [q, setQ] = useState("");
  const [qFinal, setQFinal] = useState("");
  const [estado, setEstado] = useState("");
  const [campo, setCampo] = useState("");
  const TAMANO = 50;

  // La búsqueda espera a que termines de escribir; cualquier filtro nuevo vuelve a la primera página.
  useEffect(() => { const t = setTimeout(() => { setQFinal(q.trim()); setPagina(1); }, 400); return () => clearTimeout(t); }, [q]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["sync-change-requests-history", pagina, estado, campo, qFinal],
    queryFn: () => syncApi.changeRequestsHistory({ page: pagina, limit: TAMANO, status: estado, field: campo, q: qFinal }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const errorDelServidor = data?.error;
  const filas = data?.data?.data ?? [];
  const total = data?.data?.total ?? 0;
  const totalPaginas = data?.data?.totalPages ?? 1;
  const desde = total ? (pagina - 1) * TAMANO + 1 : 0;
  const hasta = Math.min(pagina * TAMANO, total);
  const hayErrores = estado === "error" || filas.some((r) => r.status === "error");
  const [confirmando, setConfirmando] = useState(false);

  const reenviar = useMutation({
    mutationFn: (filtro: { ids?: string[]; field?: string; q?: string }) => syncApi.retryFailedChanges(filtro),
    onSuccess: (res) => {
      setConfirmando(false);
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudieron reenviar");
      } else {
        const { reenviadas, enRevision, omitidas, restantes } = res.data;
        const motivos = [...new Set(omitidas.map((o) => o.motivo))].slice(0, 3).join(" ");
        const partes = [
          reenviadas
            ? `${reenviadas} ${reenviadas === 1 ? "envío" : "envíos"} ${enRevision ? "quedan pendientes de aprobar (arriba)" : "se están reenviando"}.`
            : "No había nada que reenviar.",
          omitidas.length ? `${omitidas.length} omitido(s): ${motivos}` : "",
          restantes ? `Quedan ${restantes}: vuelve a pulsar para seguir.` : "",
        ].filter(Boolean).join(" ");
        (reenviadas ? toast.success : toast.info)(partes, { duration: 12000 });
      }
      queryClient.invalidateQueries({ queryKey: ["sync-change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["sync-change-requests-history"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const cambiaEstado = (v: string) => { setEstado(v); setPagina(1); };
  const cambiaCampo = (v: string) => { setCampo(v); setPagina(1); };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-base">Historial{total ? ` (${total})` : ""}</h3>
        {canManage && hayErrores && (!estado || estado === "error") && (
          confirmando ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Se envía el valor actual de Synkro{campo || qFinal ? " (solo lo que coincide con tu filtro)" : ""}.</span>
              <Button size="sm" disabled={reenviar.isPending} onClick={() => reenviar.mutate({ field: campo || undefined, q: qFinal || undefined })}>
                {reenviar.isPending ? "Reenviando…" : "Sí, reenviar"}
              </Button>
              <Button variant="ghost" size="sm" disabled={reenviar.isPending} onClick={() => setConfirmando(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmando(true)}>Reenviar todos los errores</Button>
          )
        )}
      </div>
      <Filtros q={q} onQ={setQ} campo={campo} onCampo={cambiaCampo}>
        <select value={estado} onChange={(e) => cambiaEstado(e.target.value)} className={clasesDeFiltro} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {Object.entries(RESOLVED_STYLES).map(([valor, s]) => <option key={valor} value={valor}>{s.label}</option>)}
        </select>
      </Filtros>
      {isLoading ? (
        <div className="glass rounded-2xl p-4 space-y-3"><Skeleton className="h-4 w-56" /><Skeleton className="h-3 w-40" /></div>
      ) : errorDelServidor ? (
        <div className="glass rounded-2xl py-8 px-4 text-center space-y-2">
          <p className="text-sm text-red-400">No se pudo cargar el historial: {errorDelServidor}</p>
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["sync-change-requests-history"] })}>Reintentar</Button>
        </div>
      ) : !filas.length ? (
        <div className="glass rounded-2xl py-10 text-center text-sm text-muted-foreground">
          {qFinal || estado || campo ? "Ningún envío coincide con la búsqueda o el filtro." : "Todavía no hay envíos en el historial."}
        </div>
      ) : (
        <div className={cn("glass rounded-2xl overflow-hidden divide-y divide-border/50", isFetching && "opacity-70")}>
          {filas.map((r) => {
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
                  {canManage && r.status === "error" && (
                    <Button variant="outline" size="sm" disabled={reenviar.isPending} onClick={() => reenviar.mutate({ ids: [r.id] })} title="Envía el valor que Synkro tiene ahora">
                      Reenviar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {total > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-muted-foreground">
          <span>Mostrando {desde}–{hasta} de {total}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>Anterior</Button>
            <span>Página {pagina} de {totalPaginas}</span>
            <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Cola de aprobación: cambios de precio y stock que esperan luz verde. */
export function ReviewQueue({ requests: todas, reviewMode, canManage, isLoading, campos, compacto, titulo }: Props) {
  const requests = campos ? todas.filter((r) => campos.includes(r.field)) : todas;
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [confirmarTodas, setConfirmarTodas] = useState(false);
  const [busca, setBusca] = useState("");
  const [campoFiltro, setCampoFiltro] = useState("");
  const alternar = (clave: string) => setAbiertos((prev) => { const n = new Set(prev); if (n.has(clave)) n.delete(clave); else n.add(clave); return n; });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["sync-change-requests"] });
    queryClient.invalidateQueries({ queryKey: ["sync-change-requests-history"] });
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

  // Varias a la vez: un lote de variantes o todas las pendientes. Se aprueban en tandas de 100, una tras otra (no todas en una sola
  // petición); el espaciado hacia cada canal lo controla el servidor (Falabella: lotes con espera entre uno y otro).
  const aprobarVarias = useMutation({
    mutationFn: async (ids: string[]) => {
      const TANDA = 100;
      let aprobadas = 0;
      const omitidas: { id: string; motivo: string }[] = [];
      for (let i = 0; i < ids.length; i += TANDA) {
        if (ids.length > TANDA) toast.loading(`Aprobando ${Math.min(i + TANDA, ids.length)} de ${ids.length}…`, { id: "aprobando-todas" });
        const res = await syncApi.approveManyChanges(ids.slice(i, i + TANDA));
        if (res.error || !res.data) {
          toast.dismiss("aprobando-todas");
          return { error: `${res.error ?? "No se pudieron aprobar"}${aprobadas ? ` (ya se aprobaron ${aprobadas}; las demás siguen pendientes)` : ""}`, data: undefined as undefined | { aprobadas: number; omitidas: { id: string; motivo: string }[] } };
        }
        aprobadas += res.data.aprobadas;
        omitidas.push(...res.data.omitidas);
      }
      toast.dismiss("aprobando-todas");
      return { error: undefined as string | undefined, data: { aprobadas, omitidas } };
    },
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
  const texto = busca.trim().toLowerCase();
  const visibles = pending.filter((r) =>
    (!campoFiltro || r.field === campoFiltro) &&
    (!texto || r.product.sku.toLowerCase().includes(texto) || r.product.name.toLowerCase().includes(texto)));
  const filtrado = visibles.length !== pending.length;
  const lotes = agrupar(visibles);

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
          <h3 className="font-semibold text-base">{titulo ?? "Pendientes"} ({filtrado ? `${visibles.length} de ${pending.length}` : pending.length})</h3>
          {canManage && visibles.length > 1 && (
            confirmarTodas ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">¿Aprobar {filtrado ? `las ${visibles.length} pendientes que ves (según tu búsqueda o filtro)` : `las ${visibles.length} pendientes`} y enviarlas a los canales? Se aprueban por tandas y el envío a cada canal va espaciado, así que puede tardar unos minutos en reflejarse.</span>
                <Button variant="outline" size="sm" onClick={() => setConfirmarTodas(false)} disabled={busyId === "__varias__"}>No</Button>
                <Button size="sm" className="gap-1.5 gradient-primary" disabled={busyId === "__varias__"} onClick={() => aprobarVarias.mutate(visibles.map((r) => r.id))}>
                  <Check className="w-3.5 h-3.5" /> Sí, aprobar
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConfirmarTodas(true)}>
                <Check className="w-3.5 h-3.5" /> {filtrado ? `Aprobar las ${visibles.length} que ves` : `Aprobar todas (${visibles.length})`}
              </Button>
            )
          )}
        </div>
        {!compacto && pending.length > 0 && (
          <Filtros q={busca} onQ={(v) => { setBusca(v); setConfirmarTodas(false); }} campo={campoFiltro} onCampo={(v) => { setCampoFiltro(v); setConfirmarTodas(false); }} />
        )}
        {isLoading ? (
          <div className="glass rounded-2xl p-4 space-y-3">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
        ) : pending.length > 0 && !visibles.length ? (
          <div className="glass rounded-2xl py-10 text-center text-sm text-muted-foreground">Ninguna pendiente coincide con la búsqueda o el filtro.</div>
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

      {!compacto && <HistorialDeSolicitudes canManage={canManage} />}
    </div>
  );
}
