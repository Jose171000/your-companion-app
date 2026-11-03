import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MousePointerClick } from "lucide-react";
import { activityAdminApi, ElementoDeMapa, FiltroDeActividad, PantallaConMapa, PlanoDePantalla } from "@/lib/activity-admin-api";
import { nombreDeElemento, nombreDePantalla } from "@/lib/activity-labels";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

/** Del amarillo (poco tocado) al rojo (lo más tocado). */
const color = (i: number, opacidad = 0.35 + 0.5 * i) => `hsl(${Math.round(50 - 50 * i)} 95% 52% / ${opacidad.toFixed(2)})`;

/**
 * Mapa de clics de una pantalla, dibujado sobre su plano (la forma de sus bloques: títulos, tablas, tarjetas, botones…,
 * aprendida de los navegadores, sin ningún texto). Si todavía nadie mandó el plano, se dibuja solo la posición de cada
 * elemento tocado. Los controles de ventanas emergentes no tienen posición: se listan aparte y cuentan igual.
 */
export function MapaDeClics({ filtro, pantallas }: { filtro: FiltroDeActividad; pantallas: PantallaConMapa[] }) {
  const [elegida, setElegida] = useState<string>("");
  const [verMapa, setVerMapa] = useState(true);
  const pantalla = pantallas.some((p) => p.pantalla === elegida) ? elegida : pantallas[0]?.pantalla ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["activity-clicks", filtro, pantalla],
    enabled: !!pantalla,
    queryFn: async () => {
      const res = await activityAdminApi.clicks(filtro, pantalla);
      if (res.error || !res.data) throw new Error(res.error ?? "No se pudo cargar el mapa");
      return res.data;
    },
    staleTime: 30_000,
  });

  const planoQ = useQuery({
    queryKey: ["activity-layout", pantalla],
    enabled: !!pantalla,
    queryFn: async () => {
      const res = await activityAdminApi.layout(pantalla);
      if (res.error) throw new Error(res.error);
      return res.data?.plano ?? null;
    },
    staleTime: 5 * 60_000,
  });
  const plano = planoQ.data ?? null;

  const { conPosicion, sinPosicion } = useMemo(() => {
    const todos = data ?? [];
    return {
      conPosicion: todos.filter((e) => e.rect && e.rect.w !== null && e.rect.h !== null),
      sinPosicion: todos.filter((e) => !(e.rect && e.rect.w !== null && e.rect.h !== null)),
    };
  }, [data]);
  const ranking = data ?? [];

  // Las posiciones se miden sobre la altura TOTAL de la página; si los clics están todos arriba, el mapa se estira hacia
  // abajo para ocupar el lienzo (es un esquema, no una captura a escala).
  const escala = useMemo(() => {
    if (plano) return 1; // con el plano, las posiciones son las reales
    const alcance = Math.max(0, ...conPosicion.map((e) => (e.rect?.y ?? 0) + (e.rect?.h ?? 0)));
    return alcance > 0 ? Math.min(8, Math.max(1, 1000 / (alcance * 1.15))) : 1;
  }, [conPosicion, plano]);
  // Lo grande se dibuja primero para que lo pequeño (un botón dentro de una tarjeta) quede encima.
  const ordenados = useMemo(
    () => [...conPosicion].sort((a, b) => (b.rect!.w ?? 0) * (b.rect!.h ?? 0) - (a.rect!.w ?? 0) * (a.rect!.h ?? 0)),
    [conPosicion],
  );

  return (
    <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><MousePointerClick className="w-4 h-4 text-[#FCCB34]" />Mapa de clics</h3>
          <p className="text-xs text-muted-foreground max-w-xl">
            Dónde hacen clic dentro de cada pantalla. Con todas las personas y promedio, cada persona pesa lo mismo: quien más usa la plataforma no tapa a los demás.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none" data-track="ver-mapa-de-clics">
          <Switch checked={verMapa} onCheckedChange={setVerMapa} aria-label="Ver el mapa de clics sobre la pantalla" />
          Ver sobre la pantalla
        </label>
      </div>

      {pantallas.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-muted-foreground text-center">
          Todavía no hay clics registrados con estos filtros.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Pantalla">
            {pantallas.map((p) => (
              <button
                key={p.pantalla}
                type="button"
                role="tab"
                aria-selected={p.pantalla === pantalla}
                data-track="mapa-elegir-pantalla"
                onClick={() => setElegida(p.pantalla)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${p.pantalla === pantalla ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {nombreDePantalla(p.pantalla)} <span className="opacity-70 tabular-nums">· {p.clics}</span>
              </button>
            ))}
          </div>

          {isLoading ? <Skeleton className="h-72 w-full rounded-xl" /> : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
              <div>
                <div className={plano ? "max-h-[640px] overflow-y-auto rounded-xl" : undefined}>
                  <div className="relative w-full rounded-xl border border-border bg-secondary/20 overflow-hidden" style={{ aspectRatio: plano ? `1 / ${Math.min(3.2, Math.max(0.5, plano.alto / plano.ancho)).toFixed(3)}` : "16 / 10" }}>
                    {verMapa && plano && <Plano plano={plano} />}
                    {!verMapa || conPosicion.length === 0 ? (
                      <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground pointer-events-none">
                        {!verMapa ? "Mapa oculto: la lista de al lado muestra lo mismo en orden." : "Los clics de esta pantalla fueron en ventanas emergentes o menús: no tienen posición. Mira la lista de al lado."}
                      </div>
                    ) : ordenados.map((e) => <Cuadro key={e.elemento} e={e} escala={escala} />)}
                  </div>
                </div>
                {!plano && !planoQ.isLoading && verMapa && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Todavía no hay plano de esta pantalla: se arma solo cuando alguien la abre desde un computador. Mientras tanto se muestra solo la posición de lo tocado.
                  </p>
                )}
                <div className="flex items-center justify-end gap-2 mt-2 text-[10px] text-muted-foreground">
                  <span>Menos clics</span>
                  {[0.05, 0.3, 0.55, 0.8, 1].map((i) => <span key={i} className="w-5 h-3 rounded-[3px]" style={{ backgroundColor: color(i, 0.8) }} />)}
                  <span>Más clics</span>
                </div>
              </div>

              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {ranking.map((e) => (
                  <div key={e.elemento} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color(e.intensidad, 0.9) }} />
                    <span className="truncate flex-1" title={e.elemento}>{nombreDeElemento(e.elemento)}</span>
                    {!e.rect && <span className="text-[10px] text-muted-foreground">emergente</span>}
                    <span className="text-xs text-muted-foreground tabular-nums">{e.participacion.toLocaleString("es-PE")}%</span>
                    <span className="text-xs tabular-nums w-10 text-right">{e.clics}</span>
                  </div>
                ))}
                {sinPosicion.length > 0 && conPosicion.length > 0 && (
                  <p className="text-[11px] text-muted-foreground pt-1">«Emergente»: control dentro de una ventana flotante; cuenta aquí pero no se dibuja en el mapa.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const ROTULOS: Partial<Record<PlanoDePantalla["bloques"][number]["k"], string>> = { tabla: "Tabla", grafico: "Gráfico", tarjeta: "Tarjeta", pestanas: "Pestañas" };
const ESTILO_DE_BLOQUE: Record<PlanoDePantalla["bloques"][number]["k"], string> = {
  tarjeta: "border border-foreground/10 bg-foreground/[0.03] rounded-md",
  tabla: "border border-foreground/15 bg-foreground/[0.05] rounded-md",
  grafico: "border border-dashed border-foreground/20 bg-foreground/[0.04] rounded-md",
  pestanas: "bg-foreground/10 rounded-full",
  titulo: "bg-foreground/25 rounded-sm",
  campo: "border border-foreground/20 bg-background/40 rounded-sm",
  boton: "bg-foreground/10 rounded-sm",
  imagen: "bg-foreground/10 rounded-sm",
};

/** La estructura de la pantalla en gris: lo que hay (tablas, tarjetas, filtros, botones), sin ningún contenido. */
function Plano({ plano }: { plano: PlanoDePantalla }) {
  // Lo grande primero para que lo pequeño (un botón dentro de una tarjeta) quede encima.
  const bloques = useMemo(() => [...plano.bloques].sort((a, b) => b.w * b.h - a.w * a.h), [plano]);
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {bloques.map((b, i) => (
        <div
          key={i}
          className={`absolute overflow-hidden ${ESTILO_DE_BLOQUE[b.k]}`}
          style={{ left: `${b.x / 10}%`, top: `${b.y / 10}%`, width: `${b.w / 10}%`, height: `${b.h / 10}%` }}
        >
          {ROTULOS[b.k] && b.w >= 60 && b.h >= 30 && <span className="block px-1.5 pt-1 text-[9px] leading-none text-foreground/35">{ROTULOS[b.k]}</span>}
        </div>
      ))}
    </div>
  );
}

function Cuadro({ e, escala }: { e: ElementoDeMapa; escala: number }) {
  const r = { ...e.rect!, y: e.rect!.y * escala, h: (e.rect!.h ?? 0) * escala };
  const ancho = Math.max(r.w ?? 0, 18);
  const alto = Math.max(r.h ?? 0, 26);
  return (
    <div
      className="absolute rounded-[5px] border border-black/20 dark:border-white/20 flex items-center justify-center overflow-hidden text-[10px] leading-none text-black/80"
      style={{
        left: `${Math.min(r.x / 10, 100 - ancho / 10)}%`,
        top: `${Math.min(r.y / 10, 100 - alto / 10)}%`,
        width: `${ancho / 10}%`,
        height: `${alto / 10}%`,
        backgroundColor: color(e.intensidad),
      }}
      title={`${nombreDeElemento(e.elemento)}: ${e.clics} clics · ${e.usuarios} ${e.usuarios === 1 ? "persona" : "personas"} · ${e.participacion.toLocaleString("es-PE")}%`}
    >
      <span className="px-1 truncate">{ancho >= 90 ? `${nombreDeElemento(e.elemento)} · ${e.clics}` : e.clics}</span>
    </div>
  );
}
