import { UserListing } from "@/lib/sync-api";
import { channelName } from "./format";

/** Una cuenta de canal conectada a la tienda (Falabella, Mercado Libre, Ripley…). */
export interface CuentaConectada {
  id: string;
  marketplace: string;
  label?: string | null;
}

export interface Calidad {
  /** 0 a 100: publicaciones activas ÷ cuentas conectadas. */
  porcentaje: number;
  activas: number;
  total: number;
  /** Cuentas donde el producto no está activo (sin publicar, en proceso, pausado, con error…). */
  faltan: string[];
}

const nombreDeCuenta = (c: CuentaConectada) => `${channelName(c.marketplace)}${c.label ? ` · ${c.label}` : ""}`;

/**
 * La calidad de un producto es qué tan completo está su alcance: en cuántas de las cuentas conectadas de la tienda tiene la
 * publicación ACTIVA. 4 de 5 cuentas = 80 %. Una publicación pausada, en proceso o con error no cuenta como activa.
 * `estado` recibe el estado visible de cada publicación (el mismo que muestra el tablero).
 */
export function calidadDelProducto(listings: UserListing[], cuentas: CuentaConectada[], estado: (l: UserListing) => string): Calidad {
  const activasPorCuenta = new Set<string>();
  for (const l of listings) {
    if (estado(l) === "published" && l.connectionId) activasPorCuenta.add(l.connectionId);
  }
  // Una publicación cuya cuenta no figura entre las conectadas (se desconectó) igual cuenta, para no pasar de 100 %.
  const conocidas = new Set(cuentas.map((c) => c.id));
  const extra = [...activasPorCuenta].filter((id) => !conocidas.has(id)).length;
  const total = Math.max(cuentas.length + extra, 1);
  const activas = Math.min(activasPorCuenta.size, total);
  return {
    porcentaje: Math.round((activas / total) * 100),
    activas,
    total,
    faltan: cuentas.filter((c) => !activasPorCuenta.has(c.id)).map(nombreDeCuenta),
  };
}

/** El promedio del catálogo: el de las calidades de cada producto. */
export function calidadDelCatalogo(calidades: Calidad[]): number {
  if (!calidades.length) return 0;
  return Math.round(calidades.reduce((n, c) => n + c.porcentaje, 0) / calidades.length);
}

/** Color según qué tan completo está: verde desde 80 %, ámbar desde 50 %, rojo por debajo. */
export function colorDeCalidad(porcentaje: number): string {
  if (porcentaje >= 80) return "bg-green-500/10 text-green-400 border-green-500/30";
  if (porcentaje >= 50) return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
  return "bg-red-500/10 text-red-400 border-red-500/30";
}
