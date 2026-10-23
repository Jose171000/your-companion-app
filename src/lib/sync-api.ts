import { apiRequest } from './api';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface MarketplaceConnection {
  id: string;
  marketplace: string;
  /** Nombre con el que la tienda distingue esta cuenta de otras del mismo canal */
  label?: string | null;
  externalUserId: string;
  externalNickname?: string;
  expiresAt: string;
  status: 'active' | 'revoked' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface ListingInfo {
  marketplace: string;
  /** Cuenta del canal en la que está publicada */
  connectionId?: string | null;
  accountLabel?: string | null;
  externalId: string;
  permalink?: string;
  syncStatus: 'pending' | 'published' | 'paused' | 'error' | 'removed';
  /** Pausada por el usuario desde Synkro (en Falabella el canal la sigue mostrando activa, con stock 0) */
  pausedByUser?: boolean;
  lastStockSynced?: number;
  lastPriceSynced?: number;
  lastSyncedAt?: string;
  lastError?: string;
}

export type ChannelActionType = 'pause' | 'resume' | 'remove';

export interface ChannelActionResult {
  message: string;
  results: { linkId: string; marketplace: string; account: string | null; ok: boolean; message: string }[];
}

export interface ProductSyncStatus {
  productId: string;
  sku: string;
  stock: number;
  price: number | string;
  listings: ListingInfo[];
}

export interface UserListing extends ListingInfo {
  id: string;
  /** Moneda del canal (PEN, USD...) */
  currency?: string;
  /** Precio regular y, si hay promoción vigente, el precio con descuento del canal */
  regularPrice?: number | string | null;
  salePrice?: number | string | null;
  /** Cuenta del canal en la que está publicada y su nombre */
  connectionId?: string | null;
  accountLabel?: string | null;
  /** Imagen de esta publicación (cada variante tiene la suya) */
  imageUrl?: string | null;
  variation?: string | null;
  parentSku?: string | null;
  /** Variantes de un producto de Synkro: el tablero las junta bajo su grupo */
  groupId?: string | null;
  groupName?: string | null;
  groupCode?: string | null;
  variantValues?: Record<string, string> | null;
  /** Precio con descuento de la tienda web (futura conexión WooCommerce) */
  webPrice?: number | string | null;
  /** Promoción del producto en los marketplaces (precio con descuento y fechas AAAA-MM-DD) */
  promo?: { price: number | string | null; start: string | null; end: string | null } | null;
  productId: string;
  productName: string;
  sku: string;
  stock: number;
  price: number | string;
}

/** Una línea de una venta: lo vendido, a qué precio y cómo quedó el stock. */
export interface SaleLine {
  sku: string | null;
  title: string;
  quantity: number;
  /** Lo que pagó el cliente por unidad */
  unitPrice: number;
  listPrice?: number | null;
  shippingAmount?: number | null;
  status?: string | null;
  trackingCode?: string | null;
  carrier?: string | null;
  shippingType?: string | null;
  productId?: string | null;
  /** Stock que había antes y el que quedó después de esta venta */
  stockBefore?: number | null;
  stockAfter?: number | null;
  /** Stock de ahora y foto del producto (null si ya no está en el catálogo) */
  currentStock: number | null;
  imageUrl: string | null;
  productName: string | null;
}

export interface SaleDetails {
  customer: { name: string | null; email: string | null; phone: string | null; document: string | null; nickname?: string | null };
  shipping: {
    method: string | null; status: string | null; trackingCode: string | null; carrier: string | null;
    shipBy: string | null; deliveryBy: string | null;
    address: { line: string | null; city: string | null; region: string | null; country: string | null; postalCode: string | null; receiver: string | null; notes: string | null };
  };
  payment: { method: string | null; status: string | null; paidAmount: number | null; installments: number | null; approvedAt: string | null };
  notes: string | null;
  channelStatus: string | null;
}

export interface Sale {
  id: string;
  marketplace: string;
  externalId: string;
  orderNumber: string;
  account: { id: string; label: string } | null;
  orderDate: string;
  status: string;
  customerName: string | null;
  /** Fecha máxima para despachar */
  shipByDate: string | null;
  totalAmount: number;
  currency: string;
  itemsCount: number;
  shipping: { status: string | null; method: string | null } | null;
  lines: SaleLine[];
  details?: SaleDetails | null;
}

export interface SalesQuery {
  from?: string;
  to?: string;
  marketplace?: string;
  connectionId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'sent' | 'error';

export interface ChangeRequest {
  id: string;
  marketplace: string;
  connection?: { id: string; label?: string | null; externalNickname?: string | null } | null;
  field: 'price' | 'stock';
  previousValue: string | null;
  newValue: string;
  status: ChangeRequestStatus;
  resultMessage: string | null;
  createdAt: string;
  resolvedAt: string | null;
  product: { id: string; name: string; sku: string };
}

export interface UpdateInventoryDto {
  stock?: number;
  price?: number;
}

// ─────────────────────────────────────────────
// Sync API
// ─────────────────────────────────────────────

/** Un canal donde el producto está publicado, con lo que se le envía. */
export interface SheetChannel {
  marketplace: string;
  connectionId: string;
  account: string;
  status: string;
  lastError: string | null;
  permalink: string | null;
  sent: Record<string, any>;
  listo: boolean;
  motivo?: string;
}

export interface SheetData {
  product: {
    id: string;
    sku: string;
    name: string;
    description: string;
    aiTitle: string | null;
    aiDescription: string | null;
    descriptionHtml: string | null;
    brand: string | null;
    color: string | null;
    price: number | null;
    stock: number;
    images: string[];
    measures: { width: number | null; length: number | null; height: number | null; weight: number | null; estimated: boolean };
  };
  channels: SheetChannel[];
}

export interface FalabellaField {
  name: string;
  label: string;
  description?: string;
  inputType: string;
  options: string[];
  /** Obligatorio. Los demás son opcionales pero suben la calidad del contenido en Falabella. */
  required?: boolean;
}

export interface LaunchReport {
  channels: { marketplace: string; accounts: number; status: 'encolado' | 'omitido' | 'error'; message: string }[];
  falabella?: FalabellaPrepReport;
  estimatedMeli: string[];
}

export interface FalabellaPrepReport {
  listo: boolean;
  motivo?: string;
  category: { id: string; path: string; auto: boolean; /** alta: verificada; baja: conviene revisarla; manual: la eligió una persona */ confidence?: 'alta' | 'baja' | 'manual' } | null;
  /** Por qué la categoría necesita revisión, si la necesita. */
  categoryNote?: string;
  brand: { value: string; replaced: boolean; original?: string };
  measures: { width: number | null; length: number | null; height: number | null; weight: number | null; estimated: boolean };
  estimatedAttributes: string[];
  /** La IA redactó la descripción HTML estándar en este paso. */
  descriptionGenerated?: boolean;
  /** Atributos de la categoría con valor, de cuántos hay. */
  attributes?: { filled: number; total: number };
}

export interface FalabellaPreparation {
  categoryId: string;
  packageWidth: number;
  packageLength: number;
  packageHeight: number;
  packageWeight: number;
  attributes?: Record<string, string>;
}

export interface FalabellaImportSummary {
  /** Mercado Libre: publicaciones leídas (cada una puede dar varias filas por variante) */
  publicaciones?: number;
  /** Mercado Libre: publicaciones o variantes sin SKU, que no se pueden enlazar */
  sinSku?: number;
  total: number;
  yaEnCatalogo: number;
  nuevas: number;
  enlazadas: number;
  /** Fichas cuyo SKU ya existe en otra tienda tuya: no se tocan */
  enOtraTienda?: number;
  incompleto: boolean;
  porEstado: Record<string, number>;
  notaMedia: number | null;
  ejemplos: { sku: string; nombre: string; estado: string; nota: number | null; enCatalogo: boolean }[];
  /** Mercado Libre: publicaciones repetidas (mismo SKU en la misma cuenta). No son variantes: solo la principal se enlaza. */
  duplicadas?: number;
  duplicados?: {
    sku: string;
    publicaciones: {
      externalId: string; variationId: string | null; titulo: string; estado: string; precio: number | null; stock: number; vendidas: number;
      permalink: string | null; imagen: string | null; tipo: string | null; sincronizadaCon: string | null; principal: boolean;
    }[];
  }[];
  /** Falabella: fichas que son variantes de un mismo producto (mismo ParentSku) y cómo quedan agrupadas */
  variantes?: {
    grupos: number;
    variantes: number;
    ejemplos: { parentSku: string; nombre: string; ejes: { name: string; values: string[] }[]; variantes: number }[];
    sinResolver: {
      parentSku: string;
      skus: string[];
      motivo: string;
      /** Las fichas de la familia, para estructurarlas a mano */
      fichas?: { sku: string; nombre: string; imagen?: string | null }[];
      /** Lo que propuso la IA y no se pudo comprobar: sirve de punto de partida */
      sugerencia?: { ejes: string[]; valores: Record<string, Record<string, string>>; motivo: string };
    }[];
    /** Segundo recurso: la IA propone los ejes y se comprueban contra los datos de cada ficha */
    ia?: { intentadas: number; resueltas: number; pendientes: number };
    /** Lectura de la página pública de Falabella para las familias que los atributos no resolvieron */
    paginaPublica?: { familias: number; leidas: number; resueltas: number; bloqueada: boolean; pendientes: number; sinDatos: { parentSku: string; motivo: string }[] };
    aplicado: { gruposCreados: number; gruposActualizados: number; variantesAgrupadas: number; omitidos: { parentSku: string; motivo: string }[] } | null;
  };
}

export const syncApi = {
  /** Cuentas de marketplaces conectadas del usuario */
  getConnections: () =>
    apiRequest<MarketplaceConnection[]>('/sync/connections', { method: 'GET' }),

  /** Conecta Yavendió con la API key que el usuario pega. La clave viaja
   *  al backend y nunca vuelve: solo se responde el nombre de la empresa. */
  connectYavendio: (apiKey: string, label?: string) =>
    apiRequest<{ marketplace: string; nickname: string }>('/sync/yavendio/connect', {
      method: 'POST',
      body: JSON.stringify({ apiKey, ...(label?.trim() ? { label: label.trim() } : {}) }),
    }),

  /** Conecta Falabella con el UserID (correo) y la API key del Seller Center. */
  connectFalabella: (userId: string, apiKey: string, label?: string) =>
    apiRequest<{ marketplace: string; nickname: string }>('/sync/falabella/connect', {
      method: 'POST',
      body: JSON.stringify({ userId, apiKey, ...(label?.trim() ? { label: label.trim() } : {}) }),
    }),

  /** Conecta una tienda WooCommerce con su dirección y la clave de la API REST. */
  connectWooCommerce: (siteUrl: string, consumerKey: string, consumerSecret: string, label?: string) =>
    apiRequest<{ marketplace: string; nickname: string }>('/sync/woocommerce/connect', {
      method: 'POST',
      body: JSON.stringify({ siteUrl, consumerKey, consumerSecret, ...(label?.trim() ? { label: label.trim() } : {}) }),
    }),

  /** Conecta una tienda Shopify con su dominio .myshopify.com y el token de la Admin API. */
  connectShopify: (shop: string, accessToken: string, label?: string) =>
    apiRequest<{ marketplace: string; nickname: string }>('/sync/shopify/connect', {
      method: 'POST',
      body: JSON.stringify({ shop, accessToken, ...(label?.trim() ? { label: label.trim() } : {}) }),
    }),

  /** Trae los productos que ya existen en WooCommerce o Shopify. Con dryRun solo informa qué pasaría. */
  importChannelListings: (marketplace: 'woocommerce' | 'shopify', dryRun: boolean, connectionId?: string) =>
    apiRequest<FalabellaImportSummary>(
      `/sync/channels/${marketplace}/listings/import?dryRun=${dryRun}${connectionId ? `&connectionId=${connectionId}` : ''}`,
      { method: 'POST' },
    ),

  /** Agrupa a mano productos ya importados como variantes: nombre, ejes y valor de cada SKU. */
  groupFalabellaVariants: (dto: { parentSku: string; name: string; axes: string[]; variants: { sellerSku: string; values: Record<string, string> }[] }) =>
    apiRequest<{ gruposCreados: number; gruposActualizados: number; variantesAgrupadas: number; omitidos: { parentSku: string; motivo: string }[] }>(
      '/sync/falabella/variants/group',
      { method: 'POST', body: JSON.stringify(dto) },
    ),

  /** Trae las publicaciones que ya existen en Falabella. Con dryRun solo informa qué pasaría. */
  importFalabellaListings: (dryRun: boolean, connectionId?: string) =>
    apiRequest<FalabellaImportSummary>(
      `/sync/falabella/listings/import?dryRun=${dryRun}${connectionId ? `&connectionId=${connectionId}` : ''}`,
      { method: 'POST' },
    ),

  /** Importa (o previsualiza) las publicaciones de una cuenta de Mercado Libre, enlazadas por SKU. */
  importMeliListings: (dryRun: boolean, connectionId?: string) =>
    apiRequest<FalabellaImportSummary>(
      `/sync/mercadolibre/listings/import?dryRun=${dryRun}${connectionId ? `&connectionId=${connectionId}` : ""}`,
      { method: "POST" },
    ),

  /** Vuelve a leer ahora el estado de las publicaciones de la tienda. */
  refreshListings: () =>
    apiRequest<{ cuentas: { id: string; marketplace: string; nombre: string; revisadas: number; actualizadas: number; ausentes: number; error?: string }[] }>(
      "/sync/listings/refresh",
      { method: "POST" },
    ),

  /** Deja la constancia de las ventas de los últimos N días, sin tocar el stock. */
  importOrderHistory: (days: number, connectionId?: string) =>
    apiRequest<{
      dias: number;
      totalRegistradas: number;
      cuentas: { id: string; marketplace: string; nombre: string; registradas: number; yaRegistradas: number; incompleto: boolean; error?: string }[];
    }>(`/sync/orders/import-history?days=${days}${connectionId ? `&connectionId=${connectionId}` : ""}`, { method: "POST" }),

  /** Categorías de Falabella donde se puede publicar, filtradas por texto. */
  searchFalabellaCategories: (search: string) =>
    apiRequest<{ id: string; name: string; path: string }[]>(
      `/sync/falabella/categories?search=${encodeURIComponent(search)}`,
      { method: 'GET' },
    ),

  /** Marcas del catálogo de Falabella que coinciden con lo escrito. */
  searchFalabellaBrands: (search: string) =>
    apiRequest<string[]>(`/sync/falabella/brands?search=${encodeURIComponent(search)}`, { method: 'GET' }),

  /** Cambia la marca con la que se publica un producto en Falabella (solo del catálogo). */
  setFalabellaBrand: (productId: string, brand: string) =>
    apiRequest<{ brand: string }>(`/sync/falabella/products/${productId}/brand`, {
      method: 'PATCH',
      body: JSON.stringify({ brand }),
    }),

  /** Deja el producto listo para Falabella: categoría, marca, medidas y datos obligatorios. */
  autoPrepareFalabella: (productId: string) =>
    apiRequest<FalabellaPrepReport>(`/ai/products/${productId}/prepare-falabella`, { method: 'POST', body: JSON.stringify({}) }),

  /** Valores sugeridos para todos los atributos de una categoría de Falabella (no guarda nada). */
  suggestFalabellaAttributes: (productId: string, categoryId: string) =>
    apiRequest<{ values: Record<string, string>; estimated: string[]; filled: number; total: number }>(
      `/ai/products/${productId}/suggest-falabella-attributes`,
      { method: 'POST', body: JSON.stringify({ categoryId }) },
    ),

  /** Lanza el producto: deja listos los canales (categoría, marca, medidas, atributos, descripción HTML) y lo publica. */
  launchProduct: (productId: string, marketplaces: string[], connectionIds?: Record<string, string[]>) =>
    apiRequest<LaunchReport>(`/ai/products/${productId}/launch`, {
      method: 'POST',
      body: JSON.stringify({ marketplaces, ...(connectionIds && Object.keys(connectionIds).length ? { connectionIds } : {}) }),
    }),

  /** La ficha del producto: lo que se envía a cada canal donde está publicado. */
  getProductSheet: (productId: string) =>
    apiRequest<SheetData>(`/sync/products/${productId}/sheet`, { method: 'GET' }),

  /** Guarda cambios de la ficha; se envían solos a los canales donde está publicado. */
  saveProductSheet: (productId: string, cambios: Record<string, any>) =>
    apiRequest<{ saved: boolean; willUpdate: string[] }>(`/sync/products/${productId}/sheet`, {
      method: 'PATCH',
      body: JSON.stringify(cambios),
    }),

  /** Envía ya el contenido actual a cada canal publicado. */
  syncProductSheetNow: (productId: string) =>
    apiRequest<{ results: { marketplace: string; ok: boolean; message: string }[] }>(`/sync/products/${productId}/sheet/sync`, { method: 'POST' }),

  /** Pone al día en Falabella una ficha ya publicada (nombre, descripción, marca y atributos). */
  updateFalabellaContent: (productId: string, regenerar = false) =>
    apiRequest<{ message: string; report: FalabellaPrepReport }>(`/ai/products/${productId}/update-falabella`, {
      method: 'POST',
      body: JSON.stringify({ regenerar }),
    }),

  /** Datos obligatorios que hay que pedirle a la persona para esa categoría. */
  getFalabellaCategoryFields: (categoryId: string) =>
    apiRequest<FalabellaField[]>(`/sync/falabella/categories/${categoryId}/fields`, { method: 'GET' }),

  /** Guarda categoría, medidas y atributos de un producto para Falabella. */
  prepareFalabella: (productId: string, payload: FalabellaPreparation) =>
    apiRequest<{ message: string; listo: boolean; motivo?: string }>(
      `/sync/falabella/products/${productId}/preparation`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    ),

  /** URL de autorización OAuth de Mercado Libre */
  getMeliAuthUrl: (label?: string) =>
    apiRequest<{ authUrl: string }>(`/sync/mercadolibre/auth-url${label?.trim() ? `?label=${encodeURIComponent(label.trim())}` : ''}`, { method: 'GET' }),

  /** Desconecta una cuenta de marketplace */
  disconnect: (connectionId: string) =>
    apiRequest<{ message: string }>(`/sync/connections/${connectionId}`, {
      method: 'DELETE',
    }),

  /** Publica un producto en los marketplaces indicados (asíncrono) */
  publish: (productId: string, marketplaces: string[], connectionIds?: Record<string, string>) =>
    apiRequest<{ message: string }>(`/sync/products/${productId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ marketplaces, ...(connectionIds ? { connectionIds } : {}) }),
    }),

  /** Actualiza stock/precio local y lo sincroniza con los canales publicados */
  updateInventory: (productId: string, dto: UpdateInventoryDto) =>
    apiRequest<{ message: string; pending?: number }>(`/sync/products/${productId}/inventory`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  /** Pausa, reanuda o quita un producto de uno o de todos sus canales (sin linkIds actúa sobre todos). */
  channelAction: (productId: string, action: ChannelActionType, opts: { linkIds?: string[]; confirm?: boolean } = {}) =>
    apiRequest<ChannelActionResult>(`/sync/products/${productId}/channels/${action}`, {
      method: 'POST',
      body: JSON.stringify(opts),
    }),

  /** Estado de sincronización de un producto en cada marketplace */
  getProductStatus: (productId: string) =>
    apiRequest<ProductSyncStatus>(`/sync/products/${productId}/status`, {
      method: 'GET',
    }),

  /** Precio con descuento y fechas para Falabella; salePrice null lo quita de Synkro. No pasa por revisión. */
  setPromo: (productId: string, dto: { salePrice: number | null; saleStartDate?: string | null; saleEndDate?: string | null }) =>
    apiRequest<{ message: string }>(`/sync/products/${productId}/promo`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  /** Precio con descuento de la tienda web; null lo quita. No pasa por revisión. */
  setWebPrice: (productId: string, webPrice: number | null) =>
    apiRequest<{ message: string }>(`/sync/products/${productId}/web-price`, {
      method: 'PATCH',
      body: JSON.stringify({ webPrice }),
    }),

  /** Solicitudes de cambio de precio/stock (modo revisión) */
  getChangeRequests: (status?: ChangeRequestStatus) =>
    apiRequest<ChangeRequest[]>(`/sync/change-requests${status ? `?status=${status}` : ''}`, { method: 'GET' }),

  approveChange: (id: string) =>
    apiRequest<{ message: string }>(`/sync/change-requests/${id}/approve`, { method: 'POST' }),

  rejectChange: (id: string, reason?: string) =>
    apiRequest<{ id: string }>(`/sync/change-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getSyncSettings: () =>
    apiRequest<{ reviewMode: boolean }>('/sync/settings', { method: 'GET' }),

  setReviewMode: (enabled: boolean) =>
    apiRequest<{ reviewMode: boolean }>('/sync/settings/review-mode', {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  /** Ventas de la tienda activa, con cliente, envío, precio pagado y stock */
  getSales: (q: SalesQuery = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params.set(k, String(v));
    const qs = params.toString();
    return apiRequest<{ total: number; limit: number; offset: number; items: Sale[] }>(`/sync/orders${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  getSale: (id: string) => apiRequest<Sale>(`/sync/orders/${id}`, { method: 'GET' }),

  /** Trae ahora las ventas recientes de todas las cuentas de la tienda activa */
  syncOrders: () =>
    apiRequest<{
      cuentas: { id: string; marketplace: string; nombre: string; nuevos: number; revisados: number; error?: string }[];
      totalNuevos: number;
    }>('/sync/orders/sync', { method: 'POST' }),

  /** Todas las publicaciones del usuario en los marketplaces */
  getListings: () =>
    apiRequest<UserListing[]>('/sync/listings', { method: 'GET' }),
};
