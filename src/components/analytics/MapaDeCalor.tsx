import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface CeldaDeCalor {
  /** 0 = domingo … 6 = sábado, en hora de Lima */
  dow: number;
  /** 0-23, en hora de Lima */
  hour: number;
  orders: number;
  sales: number;
}

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
/** La semana empieza en lunes. */
const ORDEN = [1, 2, 3, 4, 5, 6, 0];
const HORAS = Array.from({ length: 24 }, (_, h) => h);

const money = (n: number) => `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const franja = (h: number) => `${String(h).padStart(2, "0")}:00 – ${String((h + 1) % 24).padStart(2, "0")}:00`;

/**
 * Mapa de calor de las ventas: qué días de la semana y a qué hora entran más pedidos (hora de Lima). Se puede ver por
 * número de pedidos o por monto vendido. Las ventas registradas a mano no entran: no tienen hora real.
 */
export function MapaDeCalor({ celdas }: { celdas: CeldaDeCalor[] }) {
  const [metrica, setMetrica] = useState<"orders" | "sales">("orders");

  const { matriz, maximo, mejorDia, mejoresHoras, mejoresFranjas, total } = useMemo(() => {
    const m = new Map<string, CeldaDeCalor>();
    for (const c of celdas) m.set(`${c.dow}-${c.hour}`, c);
    const valor = (c?: CeldaDeCalor) => (c ? c[metrica] : 0);

    const porDia = ORDEN.map((d) => ({ d, v: HORAS.reduce((s, h) => s + valor(m.get(`${d}-${h}`)), 0) }));
    const porHora = HORAS.map((h) => ({ h, v: ORDEN.reduce((s, d) => s + valor(m.get(`${d}-${h}`)), 0) }));
    const todas = celdas.map((c) => ({ ...c, v: c[metrica] })).sort((a, b) => b.v - a.v);
    const total = porDia.reduce((s, x) => s + x.v, 0);
    return {
      matriz: m,
      maximo: Math.max(0, ...todas.map((c) => c.v)),
      mejorDia: [...porDia].sort((a, b) => b.v - a.v)[0],
      mejoresHoras: [...porHora].sort((a, b) => b.v - a.v).slice(0, 3).filter((x) => x.v > 0),
      mejoresFranjas: todas.slice(0, 3).filter((c) => c.v > 0),
      total,
    };
  }, [celdas, metrica]);

  const texto = (v: number) => (metrica === "orders" ? `${v} ${v === 1 ? "pedido" : "pedidos"}` : money(v));

  return (
    <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="font-semibold">¿Cuándo entran más ventas?</h3>
          <p className="text-xs text-muted-foreground">Por día de la semana y hora (hora de Lima), en el periodo y con los filtros elegidos.</p>
        </div>
        <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs" role="group" aria-label="Medir por">
          {([["orders", "Pedidos"], ["sales", "Monto"]] as const).map(([clave, etiqueta]) => (
            <button
              key={clave}
              type="button"
              aria-pressed={metrica === clave}
              onClick={() => setMetrica(clave)}
              className={cn("px-3 py-1.5 transition-colors", metrica === clave ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">Sin ventas con hora registrada en este periodo.</div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid gap-[3px]" style={{ gridTemplateColumns: "44px repeat(24, minmax(0, 1fr))" }}>
                <div />
                {HORAS.map((h) => (
                  <div key={h} className="text-[10px] text-muted-foreground text-center tabular-nums">{h % 3 === 0 ? h : ""}</div>
                ))}
                {ORDEN.map((d) => (
                  <div key={d} className="contents">
                    <div className="text-[11px] text-muted-foreground flex items-center">{CORTO[d]}</div>
                    {HORAS.map((h) => {
                      const c = matriz.get(`${d}-${h}`);
                      const v = c ? c[metrica] : 0;
                      const intensidad = maximo > 0 ? v / maximo : 0;
                      return (
                        <div
                          key={h}
                          className="h-6 rounded-[4px] border border-border/30"
                          style={{ backgroundColor: v > 0 ? `rgba(252, 203, 52, ${0.12 + intensidad * 0.88})` : undefined }}
                          title={`${DIAS[d]} ${franja(h)}: ${c ? `${c.orders} ${c.orders === 1 ? "pedido" : "pedidos"} · ${money(c.sales)}` : "sin ventas"}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-muted-foreground">
                <span>Menos</span>
                {[0.12, 0.35, 0.6, 0.8, 1].map((o) => <span key={o} className="w-5 h-3 rounded-[3px]" style={{ backgroundColor: `rgba(252, 203, 52, ${o})` }} />)}
                <span>Más</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
            <div className="rounded-xl bg-secondary/30 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Mejor día</p>
              <p className="font-semibold">{DIAS[mejorDia.d]}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{texto(mejorDia.v)}</p>
            </div>
            <div className="rounded-xl bg-secondary/30 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Mejores horas</p>
              {mejoresHoras.map((x) => (
                <p key={x.h} className="text-sm tabular-nums">{franja(x.h)} <span className="text-xs text-muted-foreground">· {texto(x.v)}</span></p>
              ))}
            </div>
            <div className="rounded-xl bg-secondary/30 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Mejores momentos</p>
              {mejoresFranjas.map((c) => (
                <p key={`${c.dow}-${c.hour}`} className="text-sm">{CORTO[c.dow]} {franja(c.hour)} <span className="text-xs text-muted-foreground tabular-nums">· {texto(c.v)}</span></p>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
