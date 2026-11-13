import { UserListing } from "@/lib/sync-api";
import { Calidad } from "./calidad";

export type OrdenDelTablero = "nombre" | "calidad" | "stock" | "precio";

export interface FiltrosDelTablero {
  /** Id de una cuenta de canal; vacío = todas. */
  cuenta: string;
  /** Estado de la publicación (en la cuenta elegida, o en cualquiera): activa, en proceso, pausada, con error o sin publicar. */
  estado: "" | "published" | "pending" | "paused" | "error" | "none";
  calidad: "" | "completa" | "incompleta" | "baja";
  stock: "" | "con" | "sin" | "bajo";
  pendientes: boolean;
  desfasados: boolean;
  descuento: boolean;
  orden: OrdenDelTablero;
}

export const FILTROS_INICIALES: FiltrosDelTablero = {
  cuenta: "", estado: "", calidad: "", stock: "", pendientes: false, desfasados: false, descuento: false, orden: "nombre",
};

/** Stock «bajo»: de 1 a este número de unidades. */
export const STOCK_BAJO = 5;

/** Lo que hace falta saber de un producto para filtrarlo (la fila del Tablero cumple con esto). */
export interface FilaFiltrable {
  name: string;
  stock: number;
  price: number;
  promo?: { price: number | null } | null;
  pendingCount: number;
  channels: { listing: UserListing; priceDrift: boolean; stockDrift: boolean }[];
}

/** Cuántos filtros hay puestos (el orden no cuenta). */
export function filtrosActivos(f: FiltrosDelTablero): number {
  return [f.cuenta, f.estado, f.calidad, f.stock].filter(Boolean).length + [f.pendientes, f.desfasados, f.descuento].filter(Boolean).length;
}

/** ¿Hay un canal con un valor distinto al de Synkro, en una publicación activa? */
export const tieneDesfase = (r: FilaFiltrable, estado: (l: UserListing) => string): boolean =>
  r.channels.some((c) => estado(c.listing) === "published" && ((c.stockDrift && c.listing.lastStockSynced != null) || (c.priceDrift && c.listing.lastPriceSynced != null)));

export const tieneDescuento = (r: FilaFiltrable): boolean =>
  (r.promo?.price ?? null) !== null || r.channels.some((c) => c.listing.salePrice != null);

/** ¿El producto cumple todos los filtros puestos? */
export function cumpleFiltros(r: FilaFiltrable, calidad: Calidad, f: FiltrosDelTablero, estado: (l: UserListing) => string): boolean {
  const enCuenta = f.cuenta ? r.channels.filter((c) => c.listing.connectionId === f.cuenta) : r.channels;

  if (f.estado === "none") {
    // Sin publicar: en la cuenta elegida no hay publicación (o está retirada); sin cuenta, en ninguna hay una activa.
    if (f.cuenta ? enCuenta.some((c) => estado(c.listing) !== "removed") : calidad.activas > 0) return false;
  } else if (f.estado) {
    if (!enCuenta.some((c) => estado(c.listing) === f.estado)) return false;
  } else if (f.cuenta && !enCuenta.length) {
    return false; // eligió una cuenta: solo los productos que tienen publicación ahí
  }

  if (f.calidad === "completa" && calidad.porcentaje < 100) return false;
  if (f.calidad === "incompleta" && calidad.porcentaje >= 100) return false;
  if (f.calidad === "baja" && calidad.porcentaje >= 50) return false;

  if (f.stock === "con" && !(r.stock > 0)) return false;
  if (f.stock === "sin" && r.stock > 0) return false;
  if (f.stock === "bajo" && !(r.stock > 0 && r.stock <= STOCK_BAJO)) return false;

  if (f.pendientes && !(r.pendingCount > 0)) return false;
  if (f.desfasados && !tieneDesfase(r, estado)) return false;
  if (f.descuento && !tieneDescuento(r)) return false;
  return true;
}

/** Comparador del orden elegido: nombre A-Z, y calidad, stock o precio de menor a mayor (lo que más urge, primero). */
export function comparador<T>(orden: OrdenDelTablero, clave: { nombre: (x: T) => string; calidad: (x: T) => number; stock: (x: T) => number; precio: (x: T) => number }) {
  const porNombre = (a: T, b: T) => clave.nombre(a).localeCompare(clave.nombre(b), "es", { sensitivity: "base" });
  return (a: T, b: T) => {
    const d = orden === "nombre" ? 0 : orden === "calidad" ? clave.calidad(a) - clave.calidad(b) : orden === "stock" ? clave.stock(a) - clave.stock(b) : clave.precio(a) - clave.precio(b);
    return d !== 0 ? d : porNombre(a, b);
  };
}
