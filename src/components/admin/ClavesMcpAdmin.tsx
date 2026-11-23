import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Copy, KeyRound, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { adminApi, ClaveMcpAdmin } from "@/lib/admin-api";
import { storesApi } from "@/lib/stores-api";
import { API_BASE_URL } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Dónde escucha el MCP de plataforma de este servidor. */
const MCP_ADMIN_URL = `${API_BASE_URL}/api/v1/mcp/admin`;

const CADUCIDADES = [
  { valor: "7", etiqueta: "7 días" },
  { valor: "30", etiqueta: "30 días" },
  { valor: "60", etiqueta: "60 días" },
  { valor: "90", etiqueta: "90 días (máximo)" },
];

const ESTADOS: Record<ClaveMcpAdmin["estado"], { texto: string; variante: "secondary" | "outline" | "destructive" }> = {
  activa: { texto: "Activa", variante: "secondary" },
  revocada: { texto: "Revocada", variante: "outline" },
  caducada: { texto: "Caducada", variante: "outline" },
};

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-PE") : null);

const copiar = (texto: string, aviso: string) =>
  navigator.clipboard.writeText(texto).then(
    () => toast.success(aviso),
    () => toast.error("No se pudo copiar; selecciónalo y cópialo a mano"),
  );

/**
 * La pestaña «Claves MCP» del superadmin: TODAS las claves del MCP (de cada tienda y de plataforma), quién las creó y de qué
 * tienda, con poder de revocar cualquiera, y la creación de claves de plataforma (el MCP que consulta toda la agencia).
 * Nadie puede ver el valor de una clave ya creada: solo se guarda su huella.
 */
export function ClavesMcpAdmin() {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState("todas");
  const [estado, setEstado] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [permisos, setPermisos] = useState<Set<string>>(new Set());
  const [dias, setDias] = useState("30");
  const [nueva, setNueva] = useState<{ nombre: string; clave: string } | null>(null);
  const [revocando, setRevocando] = useState<string | null>(null);

  const clavesQuery = useQuery({
    queryKey: ["admin-mcp-keys", tipo, estado],
    queryFn: () => adminApi.mcpKeys({ kind: tipo === "todas" ? undefined : tipo, estado: estado === "todas" ? undefined : estado }),
  });
  const permisosQuery = useQuery({ queryKey: ["admin-mcp-platform-permissions"], queryFn: () => adminApi.mcpPlatformPermissions(), staleTime: Infinity });
  // Los títulos de los permisos de una tienda son los del catálogo de roles.
  const catalogoQuery = useQuery({ queryKey: ["permissions-catalog"], queryFn: () => storesApi.catalog(), staleTime: Infinity });

  const config = permisosQuery.data?.data;
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["admin-mcp-keys"] });

  const titulo = (clave: string) =>
    config?.permissions.find((p) => p.clave === clave)?.titulo ?? catalogoQuery.data?.data?.permisos.find((p) => p.clave === clave)?.titulo ?? clave;

  const abrirFormulario = () => {
    setNueva(null);
    setNombre("");
    setDias("30");
    setPermisos(new Set(config?.defaults ?? ["clientes.ver"]));
    setCreando(true);
  };

  const crear = useMutation({
    mutationFn: () => adminApi.createPlatformKey({ name: nombre.trim(), permissions: [...permisos], expiresInDays: Number(dias) }),
    onSuccess: (res) => {
      if (res.error || !res.data) { toast.error(res.error ?? "No se pudo crear la clave"); return; }
      setNueva({ nombre: res.data.name, clave: res.data.key });
      setCreando(false);
      refrescar();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const revocar = useMutation({
    mutationFn: (id: string) => adminApi.revokeMcpKey(id),
    onSuccess: (res) => {
      setRevocando(null);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Clave revocada: ya no funciona");
      refrescar();
    },
  });

  const alternar = (clave: string, marcado: boolean) =>
    setPermisos((previos) => {
      const siguientes = new Set(previos);
      if (marcado) {
        siguientes.add(clave);
        // Los costos de las ventas no sirven sin poder ver las tiendas: el servidor también lo completa.
        if (clave === "finanzas.ver") siguientes.add("clientes.ver");
      } else {
        siguientes.delete(clave);
        if (clave === "clientes.ver") siguientes.delete("finanzas.ver");
      }
      return siguientes;
    });

  const todas = clavesQuery.data?.data;
  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!todas) return [];
    return t ? todas.filter((c) => [c.name, c.store?.name, c.createdBy?.email, c.createdBy?.name].some((v) => String(v ?? "").toLowerCase().includes(t))) : todas;
  }, [todas, busqueda]);

  const sensibles = (config?.permissions ?? []).filter((p) => p.sensible && permisos.has(p.clave));
  const comando = nueva ? `claude mcp add --transport http synkro-admin ${MCP_ADMIN_URL} --header "Authorization: Bearer ${nueva.clave}"` : "";
  const activas = (todas ?? []).filter((c) => c.estado === "activa").length;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Todas las claves con las que un asistente (Claude, Cursor…) consulta Synkro: las de cada tienda y las de plataforma, que ven toda la agencia.
          Aquí puedes revocar cualquiera. Nadie puede ver el valor de una clave ya creada: si se pierde, se revoca y se crea otra.
        </p>
      </div>

      {nueva && (
        <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4" /> Clave de plataforma «{nueva.nombre}» creada</p>
          <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Cópiala ahora: no se vuelve a mostrar. Es una clave maestra: no la compartas ni la pegues en chats.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={nueva.clave} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" className="shrink-0 gap-1.5" onClick={() => copiar(nueva.clave, "Clave copiada")}><Copy className="h-4 w-4" /> Copiar</Button>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Para conectarla con Claude Code:</p>
            <div className="flex gap-2">
              <Input readOnly value={comando} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="outline" size="icon" aria-label="Copiar el comando" onClick={() => copiar(comando, "Comando copiado")}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">
              En otros programas: dirección <span className="font-mono">{MCP_ADMIN_URL}</span>, tipo «HTTP» y la cabecera <span className="font-mono">Authorization: Bearer …</span>.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setNueva(null)}>Ya la guardé</Button>
        </div>
      )}

      {creando ? (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <p className="text-sm font-semibold">Nueva clave de plataforma</p>
          <div className="space-y-2">
            <Label htmlFor="adm-mcp-nombre">Nombre</Label>
            <Input id="adm-mcp-nombre" placeholder="Ej.: Claude de la agencia" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Qué puede ver</Label>
            {(config?.permissions ?? []).map((p) => (
              <label key={p.clave} className="flex cursor-pointer items-start gap-2.5 rounded-lg p-1.5 hover:bg-secondary/40">
                <Checkbox className="mt-0.5" checked={permisos.has(p.clave)} onCheckedChange={(v) => alternar(p.clave, v === true)} />
                <span className="min-w-0">
                  <span className="text-sm">{p.titulo}</span>
                  <span className="block text-xs text-muted-foreground">{p.ayuda}</span>
                </span>
              </label>
            ))}
            <p className="text-xs text-muted-foreground">
              Siempre de solo lectura: no puede crear, editar, borrar ni aprobar nada. No incluye teléfonos ni correos de los compradores de cada tienda, ni la actividad de usuarios.
            </p>
            {sensibles.length > 0 && (
              <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {sensibles.map((p) => p.titulo).join(" y ")}: lo que lea el asistente pasa al modelo de IA de quien tenga la clave. Dala solo a quien lo necesite.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Caducidad</Label>
            <Select value={dias} onValueChange={setDias}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>{CADUCIDADES.map((c) => <SelectItem key={c.valor} value={c.valor}>{c.etiqueta}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Es obligatoria: una clave que ve toda la agencia no debe durar para siempre. Si dejas de ser superadmin, deja de funcionar.</p>
          </div>

          <div className="flex gap-2">
            <Button className="gradient-primary gap-1.5" disabled={nombre.trim().length < 2 || permisos.size === 0 || crear.isPending} onClick={() => crear.mutate()} data-track="crear-clave-mcp-plataforma">
              {crear.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Crear clave
            </Button>
            <Button variant="outline" onClick={() => setCreando(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" className="gap-1.5" disabled={!config} onClick={abrirFormulario} data-track="nueva-clave-mcp-plataforma">
          <Plus className="h-3.5 w-3.5" /> Nueva clave de plataforma
        </Button>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Nombre, tienda o creador…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos los tipos</SelectItem>
              <SelectItem value="store">De tienda</SelectItem>
              <SelectItem value="platform">De plataforma</SelectItem>
            </SelectContent>
          </Select>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos los estados</SelectItem>
              <SelectItem value="activa">Activas</SelectItem>
              <SelectItem value="revocada">Revocadas</SelectItem>
              <SelectItem value="caducada">Caducadas</SelectItem>
            </SelectContent>
          </Select>
          {todas && <span className="text-xs text-muted-foreground sm:ml-auto">{visibles.length} claves · {activas} activas</span>}
        </div>

        {clavesQuery.isLoading && <Skeleton className="h-32 w-full" />}
        {clavesQuery.data?.error && <p className="py-6 text-center text-sm text-destructive">{clavesQuery.data.error}</p>}
        {todas && visibles.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No hay claves con estos filtros.</p>
        )}

        {visibles.map((c) => {
          const e = ESTADOS[c.estado];
          const activa = c.estado === "activa";
          return (
            <div key={c.id} className={`rounded-xl border border-border p-3 ${activa ? "" : "opacity-60"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="truncate">{c.name}</span>
                    <Badge variant={c.kind === "platform" ? "default" : "secondary"} className="text-[10px] font-normal">{c.kind === "platform" ? "Plataforma" : "Tienda"}</Badge>
                    <Badge variant={e.variante} className="text-[10px] font-normal">{e.texto}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.kind === "store" ? <>Tienda <span className="font-medium">{c.store?.name ?? "—"}</span> · </> : "Toda la agencia · "}
                    creada por {c.createdBy?.name || c.createdBy?.email || "—"}
                    {c.createdBy?.name && c.createdBy.email ? ` (${c.createdBy.email})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{c.prefix}…</span> · creada {fecha(c.createdAt)} · {c.lastUsedAt ? `último uso ${fecha(c.lastUsedAt)}` : "sin usar"}
                    {c.expiresAt && ` · ${activa ? "vence" : "venció"} ${fecha(c.expiresAt)}`}
                  </p>
                </div>
                {activa &&
                  (revocando === c.id ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs">¿Revocar?</span>
                      <Button size="sm" variant="destructive" disabled={revocar.isPending} onClick={() => revocar.mutate(c.id)}>Sí, revocar</Button>
                      <Button size="sm" variant="outline" onClick={() => setRevocando(null)}>No</Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label={`Revocar ${c.name}`} onClick={() => setRevocando(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.permissions.map((p) => <Badge key={p} variant="secondary" className="text-[10px] font-normal">{titulo(p)}</Badge>)}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
