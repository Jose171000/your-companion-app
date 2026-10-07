import { apiRequest } from './api';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface MarketplaceConnection {
  id: string;
  marketplace: string;
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
  productId: string;
  productName: string;
  sku: string;
  stock: number;
  price: number | string;
}

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'sent' | 'error';

export interface ChangeRequest {
  id: string;
  marketplace: string;
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
  connectYavendio: (apiKey: string) =>
    apiRequest<{ marketplace: string; nickname: string }>('/sync/yavendio/connect', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    }),

  /** Conecta Falabella con el UserID (correo) y la API key del Seller Center. */
  connectFalabella: (userId: string, apiKey: string) =>
    apiRequest<{ marketplace: string; nickname: string }>('/sync/falabella/connect', {
      method: 'POST',
      body: JSON.stringify({ userId, apiKey }),
    }),

  /** Trae las publicaciones que ya existen en Falabella. Con dryRun solo informa qué pasaría. */
  importFalabellaListings: (dryRun: boolean) =>
    apiRequest<FalabellaImportSummary>(`/sync/falabella/listings/import?dryRun=${dryRun}`, { method: 'POST' }),

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
  getMeliAuthUrl: () =>
    apiRequest<{ authUrl: string }>('/sync/mercadolibre/auth-url', { method: 'GET' }),

  /** Desconecta una cuenta de marketplace */
  disconnect: (marketplace: string) =>
    apiRequest<{ message: string }>(`/sync/connections/${marketplace}`, {
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

  /** Todas las publicaciones del usuario en los marketplaces */
  getListings: () =>
    apiRequest<UserListing[]>('/sync/listings', { method: 'GET' }),
};
