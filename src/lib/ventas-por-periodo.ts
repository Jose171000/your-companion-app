/**
 * Agrupa las ventas diarias por día, semana, mes o año DENTRO del rango elegido, y lo compara con el periodo anterior de la misma duración.
 * Funciones puras (sin red ni zona horaria: las fechas son «AAAA-MM-DD» y se manejan en UTC solo para sumar días).
 */

export type Agrupacion = "dia" | "semana" | "mes" | "anio";

export interface VentaDelDia { date: string; sales: number; orders: number }

export interface PuntoDeVentas {
  clave: string;
  /** Etiqueta corta del eje. */
  label: string;
  /** Texto completo para el tooltip. */
  titulo: string;
  sales: number;
  orders: number;
}

/** Un punto del periodo elegido junto con el que le corresponde del periodo anterior (por posición). */
export interface PuntoComparado extends PuntoDeVentas {
  prevSales: number | null;
  prevOrders: number | null;
  prevTitulo: string | null;
}

export interface PeriodoAnterior {
  from: string;
  to: string;
  /** Cómo se llama en pantalla («mes anterior», «30 días anteriores»). */
  etiqueta: string;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const aFecha = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};
const aTexto = (d: Date): string => d.toISOString().slice(0, 10);
const sumarDias = (d: Date, n: number): Date => new Date(d.getTime() + n * 86_400_000);
const corto = (s: string): string => { const [, m, d] = s.split("-"); return `${d}/${m}`; };
const diasEntre = (from: string, to: string): number => Math.round((aFecha(to).getTime() - aFecha(from).getTime()) / 86_400_000) + 1;
const ultimoDiaDelMes = (anio: number, mes0: number): number => new Date(Date.UTC(anio, mes0 + 1, 0)).getUTCDate();

/** El lunes de la semana de esa fecha. */
const lunesDe = (s: string): string => {
  const d = aFecha(s);
  return aTexto(sumarDias(d, -((d.getUTCDay() + 6) % 7)));
};

/** Primer y último día del periodo al que pertenece la fecha. */
function limitesDe(fecha: string, modo: Agrupacion): { desde: string; hasta: string } {
  const d = aFecha(fecha);
  if (modo === "semana") { const l = lunesDe(fecha); return { desde: l, hasta: aTexto(sumarDias(aFecha(l), 6)) }; }
  if (modo === "mes") return { desde: aTexto(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))), hasta: aTexto(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))) };
  if (modo === "anio") return { desde: `${d.getUTCFullYear()}-01-01`, hasta: `${d.getUTCFullYear()}-12-31` };
  return { desde: fecha, hasta: fecha };
}

function etiquetas(desde: string, hasta: string, modo: Agrupacion): { label: string; titulo: string } {
  const d = aFecha(desde);
  const anio = d.getUTCFullYear();
  if (modo === "semana") return { label: corto(desde), titulo: `Semana del ${corto(desde)} al ${corto(hasta)}` };
  if (modo === "mes") return { label: `${MESES[d.getUTCMonth()]} ${String(anio).slice(2)}`, titulo: `${MESES_LARGOS[d.getUTCMonth()][0].toUpperCase()}${MESES_LARGOS[d.getUTCMonth()].slice(1)} ${anio}` };
  if (modo === "anio") return { label: String(anio), titulo: `Año ${anio}` };
  return { label: corto(desde), titulo: `${corto(desde)}/${anio}` };
}

/** El periodo siguiente al que empieza en `desde`. */
function siguiente(desde: string, modo: Agrupacion): string {
  const d = aFecha(desde);
  if (modo === "semana") return aTexto(sumarDias(d, 7));
  if (modo === "mes") return aTexto(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
  if (modo === "anio") return `${d.getUTCFullYear() + 1}-01-01`;
  return aTexto(sumarDias(d, 1));
}

/**
 * Suma las ventas por periodo, cubriendo TODO el rango elegido: los periodos sin ventas salen en 0 (si no, el gráfico engañaría).
 * El primer y el último periodo pueden quedar parciales si el rango no empieza o termina en el borde de una semana, mes o año.
 */
export function agruparVentas(dias: VentaDelDia[], modo: Agrupacion, from: string, to: string): PuntoDeVentas[] {
  if (!from || !to || from > to) return [];
  const mapa = new Map<string, { sales: number; orders: number }>();
  for (const x of dias) {
    if (x.date < from || x.date > to) continue;
    const { desde } = limitesDe(x.date, modo);
    const actual = mapa.get(desde) ?? { sales: 0, orders: 0 };
    actual.sales += Number(x.sales) || 0;
    actual.orders += Number(x.orders) || 0;
    mapa.set(desde, actual);
  }
  const salida: PuntoDeVentas[] = [];
  const ultimo = limitesDe(to, modo).desde;
  for (let k = limitesDe(from, modo).desde; k <= ultimo; k = siguiente(k, modo)) {
    const { hasta } = limitesDe(k, modo);
    const v = mapa.get(k) ?? { sales: 0, orders: 0 };
    salida.push({ clave: k, ...etiquetas(k, hasta, modo), sales: Math.round(v.sales * 100) / 100, orders: v.orders });
  }
  return salida;
}

/**
 * El periodo con el que comparar: el inmediatamente anterior y de la MISMA duración. Si lo elegido son meses calendario completos
 * (del 1 al último día), se compara con los mismos meses anteriores; si no, con los mismos días anteriores (30 días → los 30 anteriores).
 */
export function periodoAnterior(from: string, to: string): PeriodoAnterior | null {
  if (!from || !to || from > to) return null;
  const a = aFecha(from);
  const b = aFecha(to);
  const esMesCompleto = a.getUTCDate() === 1 && b.getUTCDate() === ultimoDiaDelMes(b.getUTCFullYear(), b.getUTCMonth());
  if (esMesCompleto) {
    const meses = (b.getUTCFullYear() * 12 + b.getUTCMonth()) - (a.getUTCFullYear() * 12 + a.getUTCMonth()) + 1;
    const desde = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() - meses, 1));
    const hasta = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 0));
    return { from: aTexto(desde), to: aTexto(hasta), etiqueta: meses === 1 ? "mes anterior" : meses === 12 ? "año anterior" : `${meses} meses anteriores` };
  }
  const n = diasEntre(from, to);
  const hasta = sumarDias(a, -1);
  return { from: aTexto(sumarDias(hasta, -(n - 1))), to: aTexto(hasta), etiqueta: n === 1 ? "día anterior" : `${n} días anteriores` };
}

/** Une cada punto con el que ocupa la misma posición en el periodo anterior. */
export function compararConAnterior(actual: PuntoDeVentas[], anterior: PuntoDeVentas[]): PuntoComparado[] {
  return actual.map((p, i) => ({
    ...p,
    prevSales: anterior[i]?.sales ?? null,
    prevOrders: anterior[i]?.orders ?? null,
    prevTitulo: anterior[i]?.titulo ?? null,
  }));
}

/** Variación en % entre dos totales; null si el anterior fue 0 (no hay base para comparar). */
export function variacion(actual: number, anterior: number): number | null {
  return anterior > 0 ? Math.round(((actual - anterior) / anterior) * 1000) / 10 : null;
}

export function sumaDeVentas(dias: { sales: number; orders: number }[]): { sales: number; orders: number } {
  return dias.reduce((s, x) => ({ sales: s.sales + (Number(x.sales) || 0), orders: s.orders + (Number(x.orders) || 0) }), { sales: 0, orders: 0 });
}

/** El periodo con más ventas. */
export function mejorPeriodo(puntos: PuntoDeVentas[]): PuntoDeVentas | null {
  return puntos.reduce<PuntoDeVentas | null>((mejor, p) => (!mejor || p.sales > mejor.sales ? p : mejor), null);
}

/** «dd/mm/aaaa» de una fecha «AAAA-MM-DD». */
export const fechaLarga = (s: string): string => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
