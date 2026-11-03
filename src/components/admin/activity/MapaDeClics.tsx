import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MousePointerClick } from "lucide-react";
import { activityAdminApi, ElementoDeMapa, FiltroDeActividad, PantallaConMapa } from "@/lib/activity-admin-api";
import { nombreDeElemento, nombreDePantalla } from "@/lib/activity-labels";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

/** Del amarillo (poco tocado) al rojo (lo más tocado). */
const color = (i: number, opacidad = 0.35 + 0.5 * i) => `hsl(${Math.round(50 - 50 * i)} 95% 52% / ${opacidad.toFixed(2)})`;

/**
 * Mapa de clics de una pantalla. La posición de cada elemento se aprendió de los propios clics, así que es un esquema
 * (cada control en el lugar medio donde se tocó), no una captura. Los controles de ventanas emergentes no tienen posición:
 * se listan aparte y cuentan igual.
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

  const { conPosicion, sinPosicion } = useMemo(() => {
    const todos = data ?? [];
    return {
      conPosicion: todos.filter((e) => e.rect && e.rect.w !== null && e.rect.h !== null),
      sinPosicion: todos.filter((e) => !(e.rect && e.rect.w !== null && e.rect.h !== null)),
    };
  }, [data]);
  const ranking = data ?? [];

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
                <div className="relative w-full rounded-xl border border-border bg-secondary/20 overflow-hidden" style={{ aspectRatio: "16 / 10" }}>
                  {!verMapa || conPosicion.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
                      {verMapa ? "Los clics de esta pantalla fueron en ventanas emergentes o menús: no tienen posición. Mira la lista de al lado." : "Mapa oculto: la lista de al lado muestra lo mismo en orden."}
                    </div>
                  ) : conPosicion.map((e) => <Cuadro key={e.elemento} e={e} />)}
                </div>
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

function Cuadro({ e }: { e: ElementoDeMapa }) {
  const r = e.rect!;
  const ancho = Math.max(r.w ?? 0, 18);
  const alto = Math.max(r.h ?? 0, 14);
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
