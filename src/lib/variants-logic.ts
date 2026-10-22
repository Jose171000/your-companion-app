import type { DeteccionDeVariantes, EjeDeVariacion } from './variants-api';

/** Combinación de valores de una variante, ej. { Color: 'Rojo', Talla: 'M' }. */
export type Valores = Record<string, string>;

export const MAX_VARIANTES = 100;
export const MAX_FOTOS_POR_VARIANTE = 8;

export const SUGERIDOS: Record<string, string[]> = {
  Color: ['Rojo', 'Azul', 'Rosa', 'Negro', 'Blanco'],
  Talla: ['S', 'M', 'L', 'XL'],
  Tamaño: ['1.5 plazas', '2 plazas', 'Queen', 'King'],
  Personaje: ['Mickey', 'Stitch', 'Hello Kitty'],
  Largo: ['90 cm', '120 cm'],
  Material: ['Algodón', 'Poliéster'],
};

export const normalizar = (t: unknown): string =>
  String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Todas las combinaciones posibles de los ejes. */
export function combinaciones(ejes: EjeDeVariacion[]): Valores[] {
  if (!ejes.length || ejes.some((e) => !e.values.length)) return [];
  return ejes.reduce<Valores[]>((acc, eje) => acc.flatMap((a) => eje.values.map((v) => ({ ...a, [eje.name]: v }))), [{}]);
}

export const claveDe = (valores: Valores, ejes: EjeDeVariacion[]): string => ejes.map((e) => valores[e.name]).join('|');
export const etiquetaDe = (valores: Valores, ejes: EjeDeVariacion[]): string => ejes.map((e) => valores[e.name]).join(' · ');

const parte = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6) || 'X';

/** SKU sugerido para una variante: el código del grupo más los valores («MK-1-ROJO-M»). */
export const skuSugerido = (codigo: string, valores: Valores, ejes: EjeDeVariacion[]): string =>
  `${codigo.trim()}-${ejes.map((e) => parte(valores[e.name])).join('-')}`;

/**
 * Regla de las fotos por lotes (opción A): si todas las variantes marcadas ya tienen la foto, se quita de todas;
 * si no, se agrega al final de las que no la tienen (hasta el tope por variante).
 */
export function alternarFoto(
  asignaciones: Record<string, number[]>,
  marcadas: string[],
  foto: number,
): Record<string, number[]> {
  if (!marcadas.length) return asignaciones;
  const todas = marcadas.every((k) => (asignaciones[k] ?? []).includes(foto));
  const salida = { ...asignaciones };
  for (const k of marcadas) {
    const lista = [...(salida[k] ?? [])];
    const pos = lista.indexOf(foto);
    if (todas) lista.splice(pos, 1);
    else if (pos < 0 && lista.length < MAX_FOTOS_POR_VARIANTE) lista.push(foto);
    salida[k] = lista;
  }
  return salida;
}

/** Fotos propuestas por la IA: cada foto va a las variantes que tengan sus valores; una sola foto sin valores va a todas. */
export function asignacionInicial(
  variantes: Valores[],
  ejes: EjeDeVariacion[],
  totalFotos: number,
  deteccion: DeteccionDeVariantes | null,
): Record<string, number[]> {
  const salida: Record<string, number[]> = {};
  for (const v of variantes) salida[claveDe(v, ejes)] = [];
  if (!totalFotos) return salida;
  const mapeadas = (deteccion?.fotos ?? []).filter((f) => f.valores);
  if (mapeadas.length) {
    const comunes = (deteccion?.fotos ?? []).filter((f) => !f.valores).map((f) => f.indice - 1);
    for (const v of variantes) {
      const k = claveDe(v, ejes);
      const propias = mapeadas
        .filter((f) => Object.entries(f.valores!).every(([eje, valor]) => normalizar(v[eje]) === normalizar(valor)))
        .map((f) => f.indice - 1);
      salida[k] = [...new Set([...propias, ...comunes])].filter((i) => i >= 0 && i < totalFotos).slice(0, MAX_FOTOS_POR_VARIANTE);
    }
  } else if (totalFotos === 1) {
    for (const v of variantes) salida[claveDe(v, ejes)] = [0];
  }
  return salida;
}

/** Precio de una variante cuando depende de uno o dos ejes: la clave es el valor (o «valor1|valor2») de esos ejes. */
export function precioDeVariante(
  valores: Valores,
  ejesDelPrecio: string[],
  precios: Record<string, string>,
  base: string,
): string {
  if (!ejesDelPrecio.length) return base;
  const clave = ejesDelPrecio.map((e) => valores[e]).join('|');
  return precios[clave] ?? base;
}
