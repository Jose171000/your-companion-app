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
  productId: string;
  productName: string;
  sku: string;
  stock: number;
  price: number | string;
}

export interface UpdateInventoryDto {
  stock?: number;
  price?: number;
}

// ─────────────────────────────────────────────
// Sync API
// ─────────────────────────────────────────────

export const syncApi = {
  /** Cuentas de marketplaces conectadas del usuario */
  getConnections: () =>
    apiRequest<MarketplaceConnection[]>('/sync/connections', { method: 'GET' }),

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
    apiRequest<{ message: string }>(`/sync/products/${productId}/inventory`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  /** Estado de sincronización de un producto en cada marketplace */
  getProductStatus: (productId: string) =>
    apiRequest<ProductSyncStatus>(`/sync/products/${productId}/status`, {
      method: 'GET',
    }),

  /** Todas las publicaciones del usuario en los marketplaces */
  getListings: () =>
    apiRequest<UserListing[]>('/sync/listings', { method: 'GET' }),
};
