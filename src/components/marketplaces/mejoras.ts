import { UserListing } from "@/lib/sync-api";
import { channelName } from "./format";
import { CuentaConectada } from "./calidad";

/** Lo que hace falta saber de un producto para decir qué le falta (la fila del Tablero cumple con esto). */
export interface ProductoParaMejoras {
  name: string;
  stock: number;
  pendingCount: number;
  channels: { listing: UserListing; priceDrift: boolean; stockDrift: boolean }[];
}

export interface PasoDeMejora {
  /** «none» (sin publicar), «pending», «paused», «error» o «removed». */
  estado: string;
  /** Cuántas variantes están en ese caso (1 si es un producto solo). */
  n: number;
  texto: string;
}

export interface MejoraDeCuenta {
  cuenta: string;
  activas: number;
  total: number;
  pasos: PasoDeMejora[];
}

export interface MejorasDeCalidad {
  cuentas: MejoraDeCuenta[];
  /** Otros avisos útiles que no cambian el porcentaje (sin stock, valores distintos en el canal, pendientes). */
  avisos: string[];
}

const nombreDeCuenta = (c: CuentaConectada) => `${channelName(c.marketplace)}${c.label ? ` · ${c.label}` : ""}`;
const recortar = (t: string, max = 160) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);

/** Qué hacer para cada caso en que la publicación no está activa. */
function textoDePaso(estado: string, l?: UserListing): string {
  switch (estado) {
    case "none": return "Todavía no está publicado en esta cuenta. Publícalo desde Productos › Publicar.";
    case "pending": return "Aún en proceso: el canal lo está revisando. Vuelve a mirar en un rato.";
    case "paused": return l?.pausedByUser
      ? "Lo pausaste tú: reanúdalo desde el menú ⋮ de esta cuenta."
      : "Está pausado en el canal: revisa que tenga stock y reanúdalo desde el menú ⋮.";
    case "error": return l?.lastError ? `Con error: ${recortar(l.lastError)}` : "Con error en el canal: abre su ficha para ver el motivo.";
    case "removed": return "Se retiró del canal: vuelve a publicarlo desde Productos › Publicar.";
    default: return "Revisa su estado en el canal.";
  }
}

/**
 * Qué le falta a un producto (o a las variantes de un grupo) para llegar al 100 % de calidad: cuenta por cuenta, en cuáles no está
 * activo y por qué, con lo que hay que hacer. Aparte, otros avisos que no mueven el porcentaje. `estado` da el estado visible de cada publicación.
 */
export function mejorasDeCalidad(productos: ProductoParaMejoras[], cuentas: CuentaConectada[], estado: (l: UserListing) => string): MejorasDeCalidad {
  const resultado: MejoraDeCuenta[] = [];
  for (const cuenta of cuentas) {
    const pasos = new Map<string, PasoDeMejora>();
    let activas = 0;
    for (const p of productos) {
      const celda = p.channels.find((c) => c.listing.connectionId === cuenta.id);
      const e = celda ? estado(celda.listing) : "none";
      if (e === "published") { activas++; continue; }
      const previo = pasos.get(e);
      if (previo) previo.n++;
      else pasos.set(e, { estado: e, n: 1, texto: textoDePaso(e, celda?.listing) });
    }
    resultado.push({
      cuenta: nombreDeCuenta(cuenta),
      activas,
      total: productos.length,
      pasos: [...pasos.values()].map((s) => (productos.length > 1 ? { ...s, texto: `${s.n} de ${productos.length} variantes. ${s.texto}` } : s)),
    });
  }

  const avisos: string[] = [];
  const varias = productos.length > 1;
  const sinStock = productos.filter((p) => p.stock <= 0).length;
  if (sinStock) avisos.push(varias ? `${sinStock} de ${productos.length} variantes sin stock: repón el stock para venderlas.` : "Sin stock: repón el stock para poder venderlo.");
  const activa = (l: UserListing) => estado(l) === "published";
  const stockDistinto = productos.reduce((n, p) => n + p.channels.filter((c) => activa(c.listing) && c.stockDrift && c.listing.lastStockSynced != null).length, 0);
  if (stockDistinto) avisos.push(`${stockDistinto} publicación(es) con un stock distinto al de Synkro: usa «Reenviar stock» en su tarjeta.`);
  const precioDistinto = productos.reduce((n, p) => n + p.channels.filter((c) => activa(c.listing) && c.priceDrift && c.listing.lastPriceSynced != null).length, 0);
  if (precioDistinto) avisos.push(`${precioDistinto} publicación(es) con un precio distinto al de Synkro: revisa «Editar precios» o reenvía el precio.`);
  const pendientes = productos.reduce((n, p) => n + p.pendingCount, 0);
  if (pendientes) avisos.push(`Hay ${pendientes} cambio(s) esperando aprobación en «Por aprobar».`);

  return { cuentas: resultado, avisos };
}
