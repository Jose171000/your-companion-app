/**
 * Agrupa las ventas diarias por día, semana, mes o año, y calcula si se está creciendo. Funciones puras (sin red ni zona horaria: las fechas
 * son «AAAA-MM-DD» y se manejan en UTC solo para sumar días).
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
  /** El periodo todavía no terminó (la semana, el mes o el año actual): no cuenta para comparar. */
  enCurso: boolean;
}

export interface Crecimiento {
  /** Variación respecto al periodo anterior, en %. */
  pct: number;
  /** Con qué se compara, para mostrarlo («último mes vs el anterior»). */
  texto: string;
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
 * Suma las ventas por periodo. Los periodos sin ventas entre el primero y el último salen en 0 (si no, el gráfico engañaría).
 * `hoy` («AAAA-MM-DD») marca los periodos que aún no terminaron.
 */
export function agruparVentas(dias: VentaDelDia[], modo: Agrupacion, hoy: string): PuntoDeVentas[] {
  if (!dias.length) return [];
  const mapa = new Map<string, { sales: number; orders: number }>();
  for (const x of dias) {
    const { desde } = limitesDe(x.date, modo);
    const actual = mapa.get(desde) ?? { sales: 0, orders: 0 };
    actual.sales += Number(x.sales) || 0;
    actual.orders += Number(x.orders) || 0;
    mapa.set(desde, actual);
  }
  const claves = [...mapa.keys()].sort();
  const salida: PuntoDeVentas[] = [];
  for (let k = claves[0]; k <= claves[claves.length - 1]; k = siguiente(k, modo)) {
    const { hasta } = limitesDe(k, modo);
    const v = mapa.get(k) ?? { sales: 0, orders: 0 };
    salida.push({ clave: k, ...etiquetas(k, hasta, modo), sales: Math.round(v.sales * 100) / 100, orders: v.orders, enCurso: modo !== "dia" && hasta >= hoy });
  }
  return salida;
}

/**
 * ¿Se está creciendo? Por día: los últimos 7 días contra los 7 anteriores (necesita 14 días de datos). Por semana, mes o año: el último
 * periodo COMPLETO contra el anterior. Devuelve null si no hay con qué comparar.
 */
export function calcularCrecimiento(dias: VentaDelDia[], puntos: PuntoDeVentas[], modo: Agrupacion): Crecimiento | null {
  const variacion = (ahora: number, antes: number) => (antes > 0 ? Math.round(((ahora - antes) / antes) * 1000) / 10 : null);
  if (modo === "dia") {
    if (dias.length < 2) return null;
    const ordenados = [...dias].sort((a, b) => a.date.localeCompare(b.date));
    const ultimo = ordenados[ordenados.length - 1].date;
    if (ordenados[0].date > aTexto(sumarDias(aFecha(ultimo), -13))) return null;
    const suma = (desde: string, hasta: string) => ordenados.filter((x) => x.date >= desde && x.date <= hasta).reduce((s, x) => s + (Number(x.sales) || 0), 0);
    const ahora = suma(aTexto(sumarDias(aFecha(ultimo), -6)), ultimo);
    const antes = suma(aTexto(sumarDias(aFecha(ultimo), -13)), aTexto(sumarDias(aFecha(ultimo), -7)));
    const pct = variacion(ahora, antes);
    return pct === null ? null : { pct, texto: "últimos 7 días vs los 7 anteriores" };
  }
  const completos = puntos.filter((p) => !p.enCurso);
  if (completos.length < 2) return null;
  const ultimo = completos[completos.length - 1];
  const previo = completos[completos.length - 2];
  const pct = variacion(ultimo.sales, previo.sales);
  const texto = modo === "semana" ? "última semana completa vs la anterior" : modo === "mes" ? "último mes completo vs el anterior" : "último año completo vs el anterior";
  return pct === null ? null : { pct, texto };
}

/** El periodo con más ventas. */
export function mejorPeriodo(puntos: PuntoDeVentas[]): PuntoDeVentas | null {
  return puntos.reduce<PuntoDeVentas | null>((mejor, p) => (!mejor || p.sales > mejor.sales ? p : mejor), null);
}

/** «AAAA-MM-DD» de hoy en la zona horaria local. */
export function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Desde cuándo pedir las ventas para el gráfico: 12 meses para «Mes» y 3 años para «Año». Semana y día usan el rango elegido en pantalla. */
export function desdeParaGrafico(modo: Agrupacion, hoy: string): string | null {
  const d = aFecha(hoy);
  if (modo === "mes") return aTexto(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11, 1)));
  if (modo === "anio") return `${d.getUTCFullYear() - 2}-01-01`;
  return null;
}
