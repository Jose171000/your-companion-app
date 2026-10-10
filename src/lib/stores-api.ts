import { apiRequest } from './api';

export type StoreRole = 'owner' | 'editor' | 'viewer';

export interface StoreSummary {
  id: string;
  name: string;
  role: StoreRole;
  publicEnabled: boolean;
}

export interface StoreMemberInfo {
  userId: string;
  name: string;
  email: string;
  role: StoreRole;
}

export interface StoreInvitationInfo {
  id: string;
  email: string;
  role: 'editor' | 'viewer';
  expiresAt: string;
  expired: boolean;
}

/** Lo que cualquiera ve con el enlace público de una tienda (sin sesión). */
export interface PublicStoreSummary {
  name: string;
  channels: string[];
  publications: number;
  byStatus: Record<string, number>;
  averageQuality: number | null;
}

export interface StoreList {
  stores: StoreSummary[];
  /** false en las cuentas creadas por invitación */
  canCreateStores: boolean;
}

export const ROLE_LABELS: Record<StoreRole, string> = {
  owner: 'Dueño',
  editor: 'Editor',
  viewer: 'Lector',
};

export const storesApi = {
  /** Tiendas a las que el usuario tiene acceso */
  list: () => apiRequest<StoreList>('/stores', { method: 'GET' }),

  create: (name: string) =>
    apiRequest<{ id: string; name: string; role: StoreRole }>('/stores', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  rename: (storeId: string, name: string) =>
    apiRequest<{ id: string; name: string }>(`/stores/${storeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  members: (storeId: string) =>
    apiRequest<StoreMemberInfo[]>(`/stores/${storeId}/members`, { method: 'GET' }),

  changeRole: (storeId: string, userId: string, role: 'editor' | 'viewer') =>
    apiRequest<{ userId: string; role: string }>(`/stores/${storeId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeMember: (storeId: string, userId: string) =>
    apiRequest<{ removed: boolean }>(`/stores/${storeId}/members/${userId}`, { method: 'DELETE' }),

  invitations: (storeId: string) =>
    apiRequest<StoreInvitationInfo[]>(`/stores/${storeId}/invitations`, { method: 'GET' }),

  invite: (storeId: string, email: string, role: 'editor' | 'viewer') =>
    apiRequest<{ email: string; role: string; expiresAt: string; emailSent: boolean }>(
      `/stores/${storeId}/invitations`,
      { method: 'POST', body: JSON.stringify({ email, role }) },
    ),

  revokeInvitation: (storeId: string, invitationId: string) =>
    apiRequest<{ revoked: boolean }>(`/stores/${storeId}/invitations/${invitationId}`, { method: 'DELETE' }),

  acceptInvitation: (token: string) =>
    apiRequest<{ storeId: string; name: string; role: StoreRole }>('/stores/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  /** Activa, apaga o regenera el enlace público de la tienda */
  setPublicLink: (storeId: string, enabled: boolean, regenerate = false) =>
    apiRequest<{ publicEnabled: boolean; url: string | null }>(`/stores/${storeId}/public-link`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled, regenerate }),
    }),

  /** Información general pública de una tienda por su enlace (no requiere sesión) */
  publicSummary: (token: string) =>
    apiRequest<PublicStoreSummary>(`/public/stores/${encodeURIComponent(token)}`, { method: 'GET' }),
};
