import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, Eye, LogIn, MousePointerClick, ShieldCheck, Users, Zap } from "lucide-react";
import { activityAdminApi, FiltroDeActividad, PersonaDeActividad, PuestoDeRanking, ResumenDeActividad } from "@/lib/activity-admin-api";
import { diaDeSemana, duracion, franjaHoraria, nombreDeElemento, nombreDePantalla, ROLES_DE_PLATAFORMA, ROLES_DE_TIENDA } from "@/lib/activity-labels";
import { DateRangeFilter, RangoDeFechas, rangoDeUltimosDias } from "@/components/common/DateRangeFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MapaDeClics } from "./MapaDeClics";

const TODOS = "todos";
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 7];
const HORAS = Array.from({ length: 24 }, (_, h) => h);

const numero = (n: number) => Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 1 });
const fechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

async function cargar<T>(promesa: Promise<{ data?: T; error?: string }>): Promise<T> {
  const res = await promesa;
  if (res.error || res.data === undefined) throw new Error(res.error ?? "No se pudo cargar la actividad");
  return res.data;
}

/**
 * Superadmin › Actividad: cómo usan Synkro las personas de la plataforma. Solo para superadmin (el servidor también lo exige).
 * Todo sale de nuestro propio registro, sin servicios de terceros. Ver docs/actividad-de-usuarios.md en el servidor.
 */
export function ActividadModule() {
  const [rango, setRango] = useState<RangoDeFechas>(() => rangoDeUltimosDias(30));
  const [userId, setUserId] = useState("");
  const [mode, setMode] = useState<"average" | "total">("average");
  const [platformRoles, setPlatformRoles] = useState<string[]>([]);
  const [storeRoles, setStoreRoles] = useState<string[]>([]);

  const filtro: FiltroDeActividad = useMemo(
    () => ({ from: rango.from, to: rango.to, userId, platformRoles, storeRoles, mode }),
    [rango.from, rango.to, userId, platformRoles, storeRoles, mode],
  );

  const opciones = useQuery({ queryKey: ["activity-options"], queryFn: () => cargar(activityAdminApi.options()), staleTime: 60_000 });
  const resumen = useQuery({ queryKey: ["activity-overview", filtro], queryFn: () => cargar(activityAdminApi.overview(filtro)), staleTime: 30_000 });
  const personas = useQuery({ queryKey: ["activity-people", filtro], queryFn: () => cargar(activityAdminApi.people(filtro)), staleTime: 30_000, enabled: !userId });
  const pantallas = useQuery({ queryKey: ["activity-screens", filtro], queryFn: () => cargar(activityAdminApi.screens(filtro)), staleTime: 30_000 });

  const alternar = (lista: string[], valor: string, poner: (v: string[]) => void) =>
    poner(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);

  const r = resumen.data;
  const sinDatos = !!r && r.resumen.total.vistas + r.resumen.total.clics + r.resumen.total.acciones + r.resumen.total.sesiones === 0;
  const nombrePersona = opciones.data?.usuarios.find((u) => u.id === userId)?.nombre;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="glass rounded-2xl border border-border dark:border-white/10 p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 min-w-[220px]">
            <p className="text-xs text-muted-foreground">Persona</p>
            <Select value={userId || TODOS} onValueChange={(v) => setUserId(v === TODOS ? "" : v)}>
              <SelectTrigger className="w-full sm:w-[260px]" aria-label="Persona"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas las personas</SelectItem>
                {(opciones.data?.usuarios ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nombre || u.correo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!userId && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Cómo medir</p>
              <div className="inline-flex rounded-lg border border-border overflow-hidden text-sm" role="group" aria-label="Cómo medir">
                {([["average", "Promedio por persona"], ["total", "Suma de todas"]] as const).map(([clave, texto]) => (
                  <button
                    key={clave}
                    type="button"
                    aria-pressed={mode === clave}
                    data-track="actividad-modo"
                    onClick={() => setMode(clave)}
                    className={cn("px-3 py-1.5 transition-colors", mode === clave ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Periodo</p>
            <DateRangeFilter value={rango} onChange={setRango} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ChipsDeRol
            titulo="Rol en la plataforma"
            roles={opciones.data?.rolesPlataforma ?? Object.keys(ROLES_DE_PLATAFORMA)}
            nombres={ROLES_DE_PLATAFORMA}
            marcados={platformRoles}
            alternar={(v) => alternar(platformRoles, v, setPlatformRoles)}
            limpiar={() => setPlatformRoles([])}
          />
          <ChipsDeRol
            titulo="Rol dentro de la tienda"
            roles={opciones.data?.rolesTienda ?? Object.keys(ROLES_DE_TIENDA)}
            nombres={ROLES_DE_TIENDA}
            marcados={storeRoles}
            alternar={(v) => alternar(storeRoles, v, setStoreRoles)}
            limpiar={() => setStoreRoles([])}
          />
        </div>
      </div>

      {resumen.isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          No se pudo cargar la actividad: {(resumen.error as Error).message}
        </div>
      )}

      {resumen.isLoading && <Skeleton className="h-40 w-full rounded-2xl" />}

      {r && (
        <>
          <Indicadores r={r} nombrePersona={nombrePersona} />

          {sinDatos ? (
            <div className="glass rounded-2xl border border-border dark:border-white/10 p-8 text-center text-sm text-muted-foreground">
              No hay actividad registrada con estos filtros. Solo se registra a quienes aceptaron el aviso de privacidad, desde ese momento.
            </div>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <Ranking titulo="Secciones más usadas" ayuda="Pantallas que más se abren" puestos={r.secciones} nombre={nombreDePantalla} promedio={r.filtro.promedio} />
                <Ranking titulo="Funciones más usadas" ayuda="Acciones que cambian datos (registrar, editar, subir…)" puestos={r.funciones} nombre={nombreDeElemento} promedio={r.filtro.promedio} vacio="Todavía no hay acciones registradas." />
              </div>

              <Horarios celdas={r.horas} promedio={r.filtro.promedio} />

              <MapaDeClics filtro={filtro} pantallas={pantallas.data ?? []} />

              {!userId && <TablaDePersonas personas={personas.data} cargando={personas.isLoading} elegir={setUserId} />}
              {userId && r.linea && <LineaDeTiempo eventos={r.linea} nombre={nombrePersona} />}
            </>
          )}
        </>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Esta información es solo para superadmins. Solo se registra a quienes aceptaron el aviso de privacidad. Se guarda el detalle 90 días y los resúmenes hasta 2 años;
          nunca lo que se escribe en los campos, contraseñas ni datos de clientes finales.
        </span>
      </p>
    </div>
  );
}

function ChipsDeRol({ titulo, roles, nombres, marcados, alternar, limpiar }: {
  titulo: string; roles: string[]; nombres: Record<string, string>; marcados: string[]; alternar: (v: string) => void; limpiar: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{titulo} <span className="opacity-70">{marcados.length ? `· ${marcados.length} marcado${marcados.length > 1 ? "s" : ""}` : "· todos"}</span></p>
      <div className="flex flex-wrap gap-1.5">
        {roles.map((rol) => (
          <button
            key={rol}
            type="button"
            aria-pressed={marcados.includes(rol)}
            data-track="actividad-filtro-rol"
            onClick={() => alternar(rol)}
            className={cn("rounded-full border px-3 py-1 text-xs transition-colors", marcados.includes(rol) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}
          >
            {nombres[rol] ?? rol}
          </button>
        ))}
        {marcados.length > 0 && (
          <button type="button" data-track="actividad-quitar-roles" onClick={limpiar} className="text-xs text-muted-foreground underline underline-offset-2 px-1">Quitar</button>
        )}
      </div>
    </div>
  );
}

function Indicadores({ r, nombrePersona }: { r: ResumenDeActividad; nombrePersona?: string }) {
  const una = r.resumen.usuarios <= 1 || !r.resumen.promedio;
  const v = una ? r.resumen.total : r.resumen.porUsuario;
  const sub = una ? undefined : "por persona";
  const tarjetas: { icono: typeof Users; titulo: string; valor: string; sub?: string }[] = [
    { icono: Users, titulo: "Personas con actividad", valor: String(r.resumen.usuarios) },
    { icono: LogIn, titulo: "Sesiones", valor: numero(v.sesiones), sub },
    { icono: Clock, titulo: "Tiempo activo", valor: duracion(v.segundosActivos), sub },
    { icono: Eye, titulo: "Pantallas abiertas", valor: numero(v.vistas), sub },
    { icono: MousePointerClick, titulo: "Clics", valor: numero(v.clics), sub },
    { icono: Zap, titulo: "Acciones", valor: numero(v.acciones), sub },
  ];
  return (
    <div className="space-y-2">
      {nombrePersona && <p className="text-sm text-muted-foreground">Actividad de <strong className="text-foreground">{nombrePersona}</strong>{r.resumen.ultimoIngreso ? ` · última vez: ${fechaHora(r.resumen.ultimoIngreso)}` : ""}</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {tarjetas.map((t) => (
          <div key={t.titulo} className="glass rounded-2xl border border-border dark:border-white/10 p-4">
            <t.icono className="w-4 h-4 text-[#FCCB34] mb-2" />
            <p className="text-xl font-semibold tabular-nums">{t.valor}</p>
            <p className="text-xs text-muted-foreground">{t.titulo}{t.sub ? ` · ${t.sub}` : ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Ranking({ titulo, ayuda, puestos, nombre, promedio, vacio }: {
  titulo: string; ayuda: string; puestos: PuestoDeRanking[]; nombre: (t: string) => string; promedio: boolean; vacio?: string;
}) {
  return (
    <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
      <h3 className="font-semibold">{titulo}</h3>
      <p className="text-xs text-muted-foreground mb-4">{ayuda}{promedio ? " · % = parte del uso de cada persona, en promedio" : ""}</p>
      {puestos.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{vacio ?? "Sin datos."}</p>
      ) : (
        <div className="space-y-2.5">
          {puestos.slice(0, 10).map((p) => (
            <div key={p.nombre}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate" title={p.nombre}>{nombre(p.nombre)}</span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">{numero(p.total)} · {numero(p.porcentaje)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/50 mt-1 overflow-hidden">
                <div className="h-full rounded-full bg-[#FCCB34]" style={{ width: `${Math.max(2, Math.min(100, p.porcentaje))}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Horarios({ celdas, promedio }: { celdas: ResumenDeActividad["horas"]; promedio: boolean }) {
  const { mapa, maximo, mejorDia, mejoresHoras } = useMemo(() => {
    const m = new Map(celdas.map((c) => [`${c.dia}-${c.hora}`, c]));
    const porDia = ORDEN_SEMANA.map((d) => ({ d, v: HORAS.reduce((s, h) => s + (m.get(`${d}-${h}`)?.valor ?? 0), 0) }));
    const porHora = HORAS.map((h) => ({ h, v: ORDEN_SEMANA.reduce((s, d) => s + (m.get(`${d}-${h}`)?.valor ?? 0), 0) }));
    return {
      mapa: m,
      maximo: Math.max(0, ...celdas.map((c) => c.valor)),
      mejorDia: [...porDia].sort((a, b) => b.v - a.v)[0],
      mejoresHoras: [...porHora].sort((a, b) => b.v - a.v).slice(0, 3).filter((x) => x.v > 0),
    };
  }, [celdas]);

  return (
    <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
      <h3 className="font-semibold">¿Cuándo usan Synkro?</h3>
      <p className="text-xs text-muted-foreground">Por día de la semana y hora (hora de Lima). Mide movimiento (pantallas, clics y acciones){promedio ? " por persona" : ""}.</p>
      {maximo === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Sin movimiento en este periodo.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid gap-[3px]" style={{ gridTemplateColumns: "44px repeat(24, minmax(0, 1fr))" }}>
                <div />
                {HORAS.map((h) => <div key={h} className="text-[10px] text-muted-foreground text-center tabular-nums">{h % 3 === 0 ? h : ""}</div>)}
                {ORDEN_SEMANA.map((d) => (
                  <div key={d} className="contents">
                    <div className="text-[11px] text-muted-foreground flex items-center">{diaDeSemana(d).slice(0, 3)}</div>
                    {HORAS.map((h) => {
                      const c = mapa.get(`${d}-${h}`);
                      const i = c && maximo ? c.valor / maximo : 0;
                      return (
                        <div
                          key={h}
                          className="h-6 rounded-[4px] border border-border/30"
                          style={{ backgroundColor: c ? `rgba(252, 203, 52, ${0.12 + i * 0.88})` : undefined }}
                          title={`${diaDeSemana(d)} ${franjaHoraria(h)}: ${c ? `${numero(c.valor)} movimientos · ${duracion(c.segundos)} activos` : "sin movimiento"}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
            <div className="rounded-xl bg-secondary/30 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Día más activo</p>
              <p className="font-semibold">{diaDeSemana(mejorDia.d)}</p>
            </div>
            <div className="rounded-xl bg-secondary/30 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Horas más activas</p>
              {mejoresHoras.map((x) => <p key={x.h} className="text-sm tabular-nums">{franjaHoraria(x.h)}</p>)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TablaDePersonas({ personas, cargando, elegir }: { personas?: PersonaDeActividad[]; cargando: boolean; elegir: (id: string) => void }) {
  return (
    <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
      <h3 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-[#FCCB34]" />Personas</h3>
      <p className="text-xs text-muted-foreground mb-4">De la más activa a la menos activa. Toca una fila para ver solo su actividad.</p>
      {cargando ? <Skeleton className="h-32 w-full rounded-xl" /> : !personas?.length ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Sin personas con actividad.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="py-2 font-medium">Persona</th><th className="font-medium">Rol</th><th className="font-medium text-right">Sesiones</th>
                <th className="font-medium text-right">Tiempo activo</th><th className="font-medium text-right">Clics</th><th className="font-medium text-right">Acciones</th><th className="font-medium text-right">Última vez</th>
              </tr>
            </thead>
            <tbody>
              {personas.map((p) => (
                <tr key={p.userId} className="border-b border-border/40 hover:bg-secondary/20 cursor-pointer" data-track="actividad-fila-persona" onClick={() => elegir(p.userId)}>
                  <td className="py-2"><p className="font-medium">{p.nombre}</p><p className="text-xs text-muted-foreground">{p.correo}</p></td>
                  <td className="text-xs text-muted-foreground">{ROLES_DE_PLATAFORMA[p.rolPlataforma ?? ""] ?? p.rolPlataforma ?? "—"}{p.rolTienda ? ` · ${ROLES_DE_TIENDA[p.rolTienda] ?? p.rolTienda}` : ""}</td>
                  <td className="text-right tabular-nums">{p.sesiones}</td>
                  <td className="text-right tabular-nums">{duracion(p.segundosActivos)}</td>
                  <td className="text-right tabular-nums">{p.clics}</td>
                  <td className="text-right tabular-nums">{p.acciones}</td>
                  <td className="text-right text-xs text-muted-foreground">{fechaHora(p.ultimoIngreso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const TEXTO_DE_TIPO: Record<string, string> = { view: "Abrió", action: "Hizo", login: "Ingresó" };

function LineaDeTiempo({ eventos, nombre }: { eventos: NonNullable<ResumenDeActividad["linea"]>; nombre?: string }) {
  return (
    <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
      <h3 className="font-semibold">Lo último que hizo {nombre ?? "esta persona"}</h3>
      <p className="text-xs text-muted-foreground mb-4">Pantallas abiertas, acciones e ingresos (hasta 100). Los clics van en el mapa.</p>
      {eventos.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Sin movimientos en este periodo.</p> : (
        <ol className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {eventos.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex gap-3 text-sm">
              <span className="text-xs text-muted-foreground tabular-nums w-28 shrink-0 pt-0.5">{fechaHora(e.at)}</span>
              <span>
                {TEXTO_DE_TIPO[e.tipo] ?? e.tipo}{" "}
                <strong className="font-medium">{e.tipo === "action" ? nombreDeElemento(e.accion ?? e.elemento ?? "") : e.tipo === "login" ? "la plataforma" : nombreDePantalla(e.pantalla)}</strong>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
