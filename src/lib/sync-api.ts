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
  externalId: string;
  permalink?: string;
  syncStatus: 'pending' | 'published' | 'paused' | 'error';
  lastStockSynced?: number;
  lastPriceSynced?: number;
  lastSyncedAt?: string;
  lastError?: string;
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
  /** Precio con descuento de la tienda web (futura conexión WooCommerce) */
  webPrice?: number | string | null;
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

export interface FalabellaField {
  name: string;
  label: string;
  inputType: string;
  options: string[];
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

  /** Trae las publicaciones que ya existen en Falabella. Con dryRun solo informa qué pasaría. */
  importFalabellaListings: (dryRun: boolean, connectionId?: string) =>
    apiRequest<FalabellaImportSummary>(
      `/sync/falabella/listings/import?dryRun=${dryRun}${connectionId ? `&connectionId=${connectionId}` : ''}`,
      { method: 'POST' },
    ),

  /** Categorías de Falabella donde se puede publicar, filtradas por texto. */
  searchFalabellaCategories: (search: string) =>
    apiRequest<{ id: string; name: string; path: string }[]>(
      `/sync/falabella/categories?search=${encodeURIComponent(search)}`,
      { method: 'GET' },
    ),

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
  publish: (productId: string, marketplaces: string[]) =>
    apiRequest<{ message: string }>(`/sync/products/${productId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ marketplaces }),
    }),

  /** Actualiza stock/precio local y lo sincroniza con los canales publicados */
  updateInventory: (productId: string, dto: UpdateInventoryDto) =>
    apiRequest<{ message: string; pending?: number }>(`/sync/products/${productId}/inventory`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  /** Estado de sincronización de un producto en cada marketplace */
  getProductStatus: (productId: string) =>
    apiRequest<ProductSyncStatus>(`/sync/products/${productId}/status`, {
      method: 'GET',
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
