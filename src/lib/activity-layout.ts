/**
 * Plano de una pantalla para los mapas de clics de Superadmin › Actividad: la forma de sus bloques (títulos, tablas,
 * tarjetas, botones, campos…) con posición y tamaño, para dibujar los clics sobre la estructura real.
 *
 * Regla de privacidad: del DOM solo se leen la etiqueta, el rol y el tamaño de cada elemento. NUNCA su texto, sus atributos
 * ni lo que contiene. La clasificación es lógica pura (sin DOM) para poder probarla; el servidor repite la validación.
 */

export type TipoDeBloque = 'titulo' | 'tabla' | 'pestanas' | 'grafico' | 'imagen' | 'campo' | 'boton' | 'tarjeta';

export interface DescriptorDeBloque {
  tag: string;
  role: string | null;
  type: string | null;
  /** Posición y tamaño en píxeles dentro de la zona de contenido. */
  x: number; y: number; w: number; h: number;
  /** Tiene borde visible y esquinas redondeadas (lo que hace que un div parezca una tarjeta). */
  tieneBordeRedondeado: boolean;
  dentroDeBoton: boolean;
}

export interface BloqueDePlano { k: TipoDeBloque; x: number; y: number; w: number; h: number }

/** Cuántos bloques de cada tipo se guardan como máximo, y el orden de importancia si hay que recortar. */
const LIMITES: [TipoDeBloque, number][] = [
  ['tarjeta', 40], ['tabla', 12], ['grafico', 12], ['pestanas', 10], ['titulo', 20], ['campo', 30], ['imagen', 20], ['boton', 60],
];
export const MAX_BLOQUES = 150;

const CAMPOS_OCULTOS = ['hidden', 'checkbox', 'radio'];

/** Qué es este elemento, o null si no aporta a la estructura de la pantalla. */
export function clasificarBloque(d: DescriptorDeBloque): TipoDeBloque | null {
  const tag = d.tag.toLowerCase();
  const rol = d.role ?? '';
  if (['h1', 'h2', 'h3'].includes(tag)) return d.w >= 20 && d.h >= 8 ? 'titulo' : null;
  if (tag === 'table' || rol === 'table' || rol === 'grid' || rol === 'treegrid') return d.w >= 120 && d.h >= 40 ? 'tabla' : null;
  if (rol === 'tablist') return d.w >= 40 ? 'pestanas' : null;
  if (tag === 'canvas' || (tag === 'svg' && !d.dentroDeBoton)) return d.w >= 200 && d.h >= 100 ? 'grafico' : null;
  if (tag === 'img') return d.w >= 24 && d.h >= 24 ? 'imagen' : null;
  if (tag === 'textarea' || tag === 'select' || rol === 'combobox' || (tag === 'input' && !CAMPOS_OCULTOS.includes(d.type ?? ''))) return d.w >= 40 && d.h >= 16 ? 'campo' : null;
  if (tag === 'button' || rol === 'button' || tag === 'a') return d.w >= 16 && d.h >= 16 ? 'boton' : null;
  if (d.tieneBordeRedondeado) return d.w >= 120 && d.h >= 48 ? 'tarjeta' : null;
  return null;
}

const milesimas = (v: number, total: number) => Math.min(1000, Math.max(0, Math.round((v / total) * 1000)));

/** Convierte descriptores en píxeles a bloques en milésimas, sin repetidos y con tope por tipo. */
export function armarPlano(descriptores: DescriptorDeBloque[], ancho: number, alto: number): BloqueDePlano[] {
  if (!(ancho > 0) || !(alto > 0)) return [];
  const vistos = new Set<string>();
  const porTipo = new Map<TipoDeBloque, BloqueDePlano[]>();
  for (const d of descriptores) {
    const k = clasificarBloque(d);
    if (!k) continue;
    const b: BloqueDePlano = { k, x: milesimas(d.x, ancho), y: milesimas(d.y, alto), w: milesimas(d.w, ancho), h: milesimas(d.h, alto) };
    if (b.w < 3 || b.h < 2) continue;
    const clave = `${k}|${b.x}|${b.y}|${b.w}|${b.h}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const lista = porTipo.get(k) ?? [];
    lista.push(b);
    porTipo.set(k, lista);
  }
  const resultado: BloqueDePlano[] = [];
  for (const [k, max] of LIMITES) {
    // Si hay más de los permitidos, se quedan los más grandes.
    const lista = (porTipo.get(k) ?? []).sort((a, b) => b.w * b.h - a.w * a.h).slice(0, max);
    resultado.push(...lista);
  }
  return resultado.slice(0, MAX_BLOQUES);
}

// ── Lectura del DOM ───────────────────────────────────────────────────────

const SELECTOR =
  'h1, h2, h3, table, [role=table], [role=grid], [role=tablist], canvas, svg, img, input, textarea, select, [role=combobox], button, [role=button], a, section, article, [class*="rounded"][class*="border"]';

/** Lee la estructura de la sección visible. Devuelve null si la pantalla no es apta (angosta o sin contenido). */
export function capturarPlano(raiz: HTMLElement, visible: HTMLElement | null): { width: number; height: number; blocks: BloqueDePlano[] } | null {
  const origen = visible ?? raiz;
  const caja = raiz.getBoundingClientRect();
  const ancho = Math.round(caja.width);
  const alto = Math.round(raiz.scrollHeight);
  if (ancho < 700 || alto < 200) return null;

  const descriptores: DescriptorDeBloque[] = [];
  const nodos = origen.querySelectorAll<HTMLElement>(SELECTOR);
  for (let i = 0; i < nodos.length && i < 3000; i++) {
    const el = nodos[i];
    if (el.closest('[data-track-ignore]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const estilo = getComputedStyle(el);
    if (estilo.display === 'none' || estilo.visibility === 'hidden') continue;
    const redondeado = parseFloat(estilo.borderTopLeftRadius) >= 8;
    const conBorde = parseFloat(estilo.borderTopWidth) > 0 || parseFloat(estilo.borderLeftWidth) > 0;
    descriptores.push({
      tag: el.tagName,
      role: el.getAttribute('role'),
      type: el.getAttribute('type'),
      x: r.left - caja.left,
      y: r.top - caja.top,
      w: r.width,
      h: r.height,
      tieneBordeRedondeado: redondeado && conBorde,
      dentroDeBoton: !!el.closest('button, a, [role=button]'),
    });
  }
  const blocks = armarPlano(descriptores, ancho, alto);
  return blocks.length >= 3 ? { width: ancho, height: alto, blocks } : null;
}
