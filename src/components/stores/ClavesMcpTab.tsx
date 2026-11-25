import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { ClaveMcp, storesApi } from "@/lib/stores-api";
import type { Permiso } from "@/lib/store-permissions";
import { API_BASE_URL } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Dónde escucha el MCP de este servidor. */
const MCP_URL = `${API_BASE_URL}/api/v1/mcp`;

/** Lo que lleva una clave si no se cambia nada: sin datos de contacto de clientes ni costos. */
const POR_DEFECTO: Permiso[] = ["productos.ver", "canales.ver", "ventas.ver", "analiticas.ver"];
/** Lo que cada permiso necesita para tener sentido (el servidor también lo completa). */
const REQUIERE: Partial<Record<Permiso, Permiso[]>> = { "ventas.contacto": ["ventas.ver"], "productos.editar": ["productos.ver"] };
/** Permisos que no conviene dar sin pensarlo: salen en un aviso. */
const SENSIBLES: Permiso[] = ["ventas.contacto", "costos.ver"];
/** El único permiso que cambia datos. Desde el MCP hace menos que el mismo permiso en la app, y se dice así. */
const ESCRIBE: Permiso = "productos.editar";
const AYUDA_DE_ESCRITURA = "Crea productos y variantes, y edita o completa con IA los que no están en ningún canal. No publica ni cambia precio o stock de lo que ya existe.";

const ACCIONES: Record<string, string> = {
  crear_enlace_para_fotos: "Creó un enlace para subir fotos",
  crear_producto: "Creó un producto",
  crear_producto_con_variantes: "Creó un producto con variantes",
  agregar_variantes: "Agregó variantes",
  editar_producto: "Editó un producto",
  generar_contenido_ia: "Completó con IA",
};

const CADUCIDADES = [
  { valor: "ninguna", etiqueta: "Sin caducidad" },
  { valor: "30", etiqueta: "30 días" },
  { valor: "90", etiqueta: "90 días" },
  { valor: "365", etiqueta: "1 año" },
];

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : null);

const estadoDe = (c: ClaveMcp): { texto: string; activa: boolean } => {
  if (c.revokedAt) return { texto: "Revocada", activa: false };
  if (c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()) return { texto: "Caducada", activa: false };
  return { texto: "Activa", activa: true };
};

const copiar = (texto: string, aviso: string) =>
  navigator.clipboard.writeText(texto).then(
    () => toast.success(aviso),
    () => toast.error("No se pudo copiar; selecciónalo y cópialo a mano"),
  );

/**
 * La pestaña «Conexión MCP» de la gestión de la tienda: claves para que un asistente (Claude, Cursor…) consulte la tienda.
 * Solo el dueño. Por defecto son de solo lectura; la clave completa se ve una sola vez, al crearla.
 */
export function ClavesMcpTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [permisos, setPermisos] = useState<Set<Permiso>>(new Set(POR_DEFECTO));
  const [caducidad, setCaducidad] = useState("ninguna");
  const [nueva, setNueva] = useState<{ nombre: string; clave: string } | null>(null);
  const [revocando, setRevocando] = useState<string | null>(null);

  const clavesQuery = useQuery({ queryKey: ["store-api-keys", storeId], queryFn: () => storesApi.apiKeys(storeId), enabled: !!storeId });
  const permisosQuery = useQuery({ queryKey: ["mcp-permissions"], queryFn: () => storesApi.mcpPermissions(), staleTime: Infinity });
  const cambiosQuery = useQuery({ queryKey: ["store-mcp-changes", storeId], queryFn: () => storesApi.mcpChanges(storeId), enabled: !!storeId });
  // Los títulos y ayudas son los mismos del catálogo de roles.
  const catalogoQuery = useQuery({ queryKey: ["permissions-catalog"], queryFn: () => storesApi.catalog(), staleTime: Infinity });

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["store-api-keys", storeId] });
  const titulo = (clave: Permiso) => catalogoQuery.data?.data?.permisos.find((p) => p.clave === clave)?.titulo ?? clave;
  const ayuda = (clave: Permiso) => (clave === ESCRIBE ? AYUDA_DE_ESCRITURA : catalogoQuery.data?.data?.permisos.find((p) => p.clave === clave)?.ayuda ?? "");

  const reiniciar = () => {
    setCreando(false);
    setNombre("");
    setPermisos(new Set(POR_DEFECTO));
    setCaducidad("ninguna");
  };

  const crear = useMutation({
    mutationFn: () =>
      storesApi.createApiKey(storeId, {
        name: nombre.trim(),
        permissions: [...permisos],
        ...(caducidad !== "ninguna" ? { expiresInDays: Number(caducidad) } : {}),
      }),
    onSuccess: (res) => {
      if (res.error || !res.data) { toast.error(res.error ?? "No se pudo crear la clave"); return; }
      setNueva({ nombre: res.data.name, clave: res.data.key });
      reiniciar();
      refrescar();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const revocar = useMutation({
    mutationFn: (id: string) => storesApi.revokeApiKey(storeId, id),
    onSuccess: (res) => {
      setRevocando(null);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Clave revocada: ya no funciona");
      refrescar();
    },
  });

  const alternar = (clave: Permiso, marcado: boolean) => {
    setPermisos((previos) => {
      const siguientes = new Set(previos);
      if (marcado) {
        siguientes.add(clave);
        (REQUIERE[clave] ?? []).forEach((r) => siguientes.add(r));
      } else {
        siguientes.delete(clave);
        // Quitar lo que otro necesita quita también a ese otro.
        for (const [dependiente, requisitos] of Object.entries(REQUIERE) as [Permiso, Permiso[]][]) {
          if (requisitos.includes(clave)) siguientes.delete(dependiente);
        }
      }
      return siguientes;
    });
  };

  const disponibles = permisosQuery.data?.data?.permissions ?? [];
  const claves = clavesQuery.data?.data;
  const sensiblesMarcados = SENSIBLES.filter((p) => permisos.has(p));
  const cambios = cambiosQuery.data?.data ?? [];
  const nombreValido = nombre.trim().length >= 2;
  const comando = nueva ? `claude mcp add --transport http synkro ${MCP_URL} --header "Authorization: Bearer ${nueva.clave}"` : "";

  if (clavesQuery.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!claves) return <p className="text-sm text-destructive py-6 text-center">{clavesQuery.data?.error ?? "No se pudieron cargar las claves"}</p>;

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Con una clave, un asistente como Claude puede <strong>consultar</strong> esta tienda: productos, ventas, reportes y cambios pendientes.
        Si le das el permiso de productos, también puede crearlos. Nunca publica ni aprueba nada. Lo que puede hacer depende de la clave y de tus permisos.
      </p>

      {nueva && (
        <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4" /> Clave «{nueva.nombre}» creada</p>
          <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Cópiala ahora: no se vuelve a mostrar. Si la pierdes, revócala y crea otra.
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
              En otros programas: dirección <span className="font-mono">{MCP_URL}</span>, tipo «HTTP», y la cabecera <span className="font-mono">Authorization: Bearer …</span>.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setNueva(null)}>Ya la guardé</Button>
        </div>
      )}

      {creando ? (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="space-y-2">
            <Label htmlFor="mcp-nombre">Nombre</Label>
            <Input id="mcp-nombre" placeholder="Ej.: Claude de Pedro" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <p className="text-xs text-muted-foreground">Para reconocerla en la lista y saber a quién se la diste.</p>
          </div>

          <div className="space-y-2">
            <Label>Qué puede hacer</Label>
            {disponibles.map((p) => (
              <label key={p} className="flex cursor-pointer items-start gap-2.5 rounded-lg p-1.5 hover:bg-secondary/40">
                <Checkbox className="mt-0.5" checked={permisos.has(p)} onCheckedChange={(v) => alternar(p, v === true)} />
                <span className="min-w-0">
                  <span className="text-sm">{titulo(p)}</span>
                  <span className="block text-xs text-muted-foreground">{ayuda(p)}</span>
                </span>
              </label>
            ))}
            {permisos.has(ESCRIBE) && (
              <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Esta clave podrá cambiar tu catálogo. Para las fotos, el asistente puede darte un enlace para subirlas desde tu celular o tu PC.
              </p>
            )}
            {sensiblesMarcados.length > 0 && (
              <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {sensiblesMarcados.map(titulo).join(" y ")}: lo que lea el asistente pasa al modelo de quien tenga la clave. Dala solo si hace falta.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Caducidad</Label>
            <Select value={caducidad} onValueChange={setCaducidad}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{CADUCIDADES.map((c) => <SelectItem key={c.valor} value={c.valor}>{c.etiqueta}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button className="gradient-primary gap-1.5" disabled={!nombreValido || permisos.size === 0 || crear.isPending} onClick={() => crear.mutate()} data-track="crear-clave-mcp">
              {crear.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Crear clave
            </Button>
            <Button variant="outline" onClick={reiniciar}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" className="gap-1.5" onClick={() => { setNueva(null); setCreando(true); }} data-track="nueva-clave-mcp">
          <Plus className="h-3.5 w-3.5" /> Nueva clave
        </Button>
      )}

      <section className="space-y-2">
        <p className="text-sm font-semibold">Claves de esta tienda</p>
        {claves.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Todavía no hay claves. Crea una para conectar un asistente a esta tienda.
          </p>
        )}
        {claves.map((c) => {
          const estado = estadoDe(c);
          return (
            <div key={c.id} className={`rounded-xl border border-border p-3 ${estado.activa ? "" : "opacity-60"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {c.name}
                    <Badge variant={estado.activa ? "secondary" : "outline"} className="text-[10px] font-normal">{estado.texto}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{c.prefix}…</span> · creada {fecha(c.createdAt)} ·{" "}
                    {c.lastUsedAt ? `último uso ${fecha(c.lastUsedAt)}` : "sin usar"}
                    {c.expiresAt && estado.activa && ` · vence ${fecha(c.expiresAt)}`}
                  </p>
                </div>
                {estado.activa &&
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
        <p className="text-xs text-muted-foreground">
          Hasta 10 claves activas por tienda. Una clave revocada deja de funcionar al instante. Si alguien sale del equipo, sus claves pierden los permisos que tenía.
        </p>
      </section>

      {cambios.length > 0 && (
        <section className="space-y-2">
          <p className="text-sm font-semibold">Cambios hechos por asistentes</p>
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {cambios.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-2 text-xs">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{ACCIONES[c.tool] ?? c.tool}</span>
                  <span className="min-w-0 truncate">{c.resumen.name ?? c.resumen.sku ?? ""}</span>
                  {c.estado !== "hecho" && (
                    <Badge variant="outline" className="text-[10px] font-normal">{c.estado === "error" ? "No se hizo" : "Sin confirmar"}</Badge>
                  )}
                </p>
                <p className="text-muted-foreground">{c.keyName} · {new Date(c.createdAt).toLocaleString()}</p>
                {c.mensaje && <p className="break-words text-destructive">{c.mensaje}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
