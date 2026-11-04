import { useEffect, useState } from 'react';
import { useStores } from '@/contexts/StoreContext';
import type { AppNotification } from './notifications-api';

/**
 * A dónde lleva el clic en un aviso de la campana: la tienda del aviso, la sección y, dentro de ella, el producto o la venta.
 * Un aviso no sabe nada de pantallas: aquí se traduce y cada pantalla toma su parte cuando está lista (las secciones se montan
 * al visitarlas por primera vez, así que la parte espera hasta que alguien la recoge).
 */
export type Seccion = 'products' | 'marketplaces';

export interface Partes {
  /** Ficha del producto. */
  products: { productId: string };
  /** Pestaña de Marketplaces. */
  marketplaces: { pestana: 'canales' | 'tablero' | 'ventas' | 'revision' };
  /** Detalle de una venta (lo abre la lista de ventas). */
  sales: { orderId: string; marketplace?: string; desde: string };
}
export type Clave = keyof Partes;

export interface DestinoDeAviso {
  storeId?: string;
  seccion?: Seccion;
  partes: { [K in Clave]?: Partes[K] };
}

const EVENTO = 'synkro:aviso-destino';
/** Lo que no se recoge en este tiempo se olvida: un clic de hace rato no debe abrir nada de golpe. */
const VIGENCIA_MS = 2 * 60_000;

type Pendiente = { storeId?: string; creado: number; parte: unknown };
const pendientes: Partial<Record<Clave, Pendiente>> = {};

const textoDe = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : undefined;

/** Qué abrir para un aviso. Sin producto ni venta, el aviso lleva a la pantalla de su tema. */
export function destinoDe(n: AppNotification): DestinoDeAviso {
  const storeId = n.store?.id;
  const productId = textoDe(n.meta?.productId);
  const orderId = textoDe(n.meta?.orderId);

  if (n.type === 'sale' && orderId) {
    return {
      storeId,
      seccion: 'marketplaces',
      partes: { marketplaces: { pestana: 'ventas' }, sales: { orderId, marketplace: n.marketplace || undefined, desde: n.createdAt } },
    };
  }
  if (productId) return { storeId, seccion: 'products', partes: { products: { productId } } };
  if (n.type === 'sale') return { storeId, seccion: 'marketplaces', partes: { marketplaces: { pestana: 'ventas' } } };
  if (n.type === 'publish' || n.type === 'publish-error') return { storeId, seccion: 'marketplaces', partes: { marketplaces: { pestana: 'tablero' } } };
  if (n.type === 'connection' || n.type === 'import') return { storeId, seccion: 'marketplaces', partes: { marketplaces: { pestana: 'canales' } } };
  return { storeId, partes: {} };
}

export function pedirDestino(d: DestinoDeAviso) {
  const ahora = Date.now();
  for (const k of Object.keys(pendientes) as Clave[]) delete pendientes[k];
  for (const k of Object.keys(d.partes) as Clave[]) pendientes[k] = { storeId: d.storeId, creado: ahora, parte: d.partes[k] };
  window.dispatchEvent(new CustomEvent<DestinoDeAviso>(EVENTO, { detail: d }));
}

export function descartarDestino() {
  for (const k of Object.keys(pendientes) as Clave[]) delete pendientes[k];
}

/** Para quien cambia de tienda y de sección (el layout). */
export function alPedirDestino(fn: (d: DestinoDeAviso) => void): () => void {
  const oyente = (e: Event) => fn((e as CustomEvent<DestinoDeAviso>).detail);
  window.addEventListener(EVENTO, oyente);
  return () => window.removeEventListener(EVENTO, oyente);
}

/**
 * Una pantalla recoge su parte del destino. Espera a que la tienda activa sea la del aviso, así sus consultas ya van a la tienda
 * correcta. Cada parte se entrega una sola vez.
 */
export function useDestinoPendiente<K extends Clave>(clave: K, alTomar: (parte: Partes[K]) => void) {
  const { activeStore } = useStores();
  const [vez, setVez] = useState(0);

  useEffect(() => {
    const oyente = () => setVez((v) => v + 1);
    window.addEventListener(EVENTO, oyente);
    return () => window.removeEventListener(EVENTO, oyente);
  }, []);

  useEffect(() => {
    const p = pendientes[clave];
    if (!p) return;
    if (Date.now() - p.creado > VIGENCIA_MS) { delete pendientes[clave]; return; }
    if (p.storeId && p.storeId !== activeStore?.id) return;
    delete pendientes[clave];
    alTomar(p.parte as Partes[K]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vez, activeStore?.id]);
}
