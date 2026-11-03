import { apiRequest } from './api';
import type { Permiso, PermisoDelCatalogo, RolDeFabrica } from './store-permissions';

export type StoreRole = 'owner' | 'editor' | 'viewer';

export interface StoreSummary {
  id: string;
  name: string;
  role: StoreRole;
  /** Lo que puede hacer en esta tienda. Las versiones anteriores del servidor no lo mandan: se usan los de su rol. */
  permissions?: Permiso[];
  /** «Editor», «Lector», «Dueño» o el nombre de su rol personalizado. */
  roleName?: string;
  customRoleId?: string | null;
  publicEnabled: boolean;
}

export interface StoreMemberInfo {
  userId: string;
  name: string;
  email: string;
  role: StoreRole;
  /** El nombre que se muestra: «Editor», «Lector», «Dueño» o el de su rol personalizado. */
  roleName?: string;
  customRoleId?: string | null;
}

export interface StoreInvitationInfo {
  id: string;
  email: string;
  role: 'editor' | 'viewer';
  roleName?: string;
  customRoleId?: string | null;
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

export interface InvitationInfo {
  storeName: string;
  role: 'editor' | 'viewer';
  roleName?: string;
  inviterName: string | null;
  email: string;
  expiresAt: string;
}

export const ROLE_LABELS: Record<StoreRole, string> = {
  owner: 'Dueño',
  editor: 'Editor',
  viewer: 'Lector',
};

/** A qué rol pasa una persona: uno de fábrica o un rol personalizado de la tienda (exactamente uno). */
export type AsignacionDeRol = { role: 'editor' | 'viewer' } | { customRoleId: string };

/** Lo que el servidor manda en `GET /stores/permissions/catalog`. */
export interface CatalogoDeRoles {
  permisos: PermisoDelCatalogo[];
  fabrica: RolDeFabrica[];
  maximoDeRoles: number;
}

export interface RolPersonalizado {
  id: string;
  name: string;
  permissions: Permiso[];
  /** Cuántas personas lo tienen y cuántas invitaciones pendientes. */
  people: number;
  invitations: number;
  createdAt: string;
}

export interface RolesDeLaTienda extends CatalogoDeRoles {
  personalizados: RolPersonalizado[];
}

/** Lo que devuelve crear o editar un rol: además, qué permisos se agregaron solos por depender de otros. */
export type RolGuardado = RolPersonalizado & { addedAutomatically: Permiso[] };

/** El nombre de un rol para mostrarlo: el que manda el servidor, o el de fábrica. */
export const nombreDeRol = (x: { role: StoreRole; roleName?: string }) => x.roleName ?? ROLE_LABELS[x.role];

export const storesApi = {
  /** Tiendas a las que el usuario tiene acceso */
  list: () => apiRequest<StoreList>('/stores', { method: 'GET' }),

  /** Con ownerId (solo superadmin) la tienda se crea a nombre de un cliente. */
  create: (name: string, ownerId?: string) =>
    apiRequest<{ id: string; name: string; role: StoreRole }>('/stores', {
      method: 'POST',
      body: JSON.stringify({ name, ...(ownerId ? { ownerId } : {}) }),
    }),

  rename: (storeId: string, name: string) =>
    apiRequest<{ id: string; name: string }>(`/stores/${storeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  members: (storeId: string) =>
    apiRequest<StoreMemberInfo[]>(`/stores/${storeId}/members`, { method: 'GET' }),

  changeRole: (storeId: string, userId: string, asignacion: AsignacionDeRol) =>
    apiRequest<{ userId: string; role: string; roleName: string }>(`/stores/${storeId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(asignacion),
    }),

  removeMember: (storeId: string, userId: string) =>
    apiRequest<{ removed: boolean }>(`/stores/${storeId}/members/${userId}`, { method: 'DELETE' }),

  invitations: (storeId: string) =>
    apiRequest<StoreInvitationInfo[]>(`/stores/${storeId}/invitations`, { method: 'GET' }),

  invite: (storeId: string, email: string, asignacion: AsignacionDeRol) =>
    apiRequest<{ email: string; role: string; roleName: string; expiresAt: string; emailSent: boolean; acceptUrl: string }>(
      `/stores/${storeId}/invitations`,
      { method: 'POST', body: JSON.stringify({ email, ...asignacion }) },
    ),

  revokeInvitation: (storeId: string, invitationId: string) =>
    apiRequest<{ revoked: boolean }>(`/stores/${storeId}/invitations/${invitationId}`, { method: 'DELETE' }),

  acceptInvitation: (token: string) =>
    apiRequest<{ storeId: string; name: string; role: StoreRole; roleName?: string }>('/stores/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  // ── Roles personalizados (solo el dueño) ──────────────────────────────

  /** Permisos y roles de fábrica: no depende de la tienda. */
  catalog: () => apiRequest<CatalogoDeRoles>('/stores/permissions/catalog', { method: 'GET' }),

  roles: (storeId: string) => apiRequest<RolesDeLaTienda>(`/stores/${storeId}/roles`, { method: 'GET' }),

  createRole: (storeId: string, name: string, permissions: Permiso[]) =>
    apiRequest<RolGuardado>(`/stores/${storeId}/roles`, { method: 'POST', body: JSON.stringify({ name, permissions }) }),

  updateRole: (storeId: string, roleId: string, cambios: { name?: string; permissions?: Permiso[] }) =>
    apiRequest<RolGuardado>(`/stores/${storeId}/roles/${roleId}`, { method: 'PATCH', body: JSON.stringify(cambios) }),

  deleteRole: (storeId: string, roleId: string) =>
    apiRequest<{ removed: boolean }>(`/stores/${storeId}/roles/${roleId}`, { method: 'DELETE' }),

  /** Activa, apaga o regenera el enlace público de la tienda */
  setPublicLink: (storeId: string, enabled: boolean, regenerate = false) =>
    apiRequest<{ publicEnabled: boolean; url: string | null }>(`/stores/${storeId}/public-link`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled, regenerate }),
    }),

  /** A qué tienda lo invitan, con qué rol, quién y con qué correo (no requiere sesión; el código es el secreto) */
  invitationInfo: (token: string) =>
    apiRequest<InvitationInfo>(`/public/stores/invitations/${encodeURIComponent(token)}`, { method: 'GET' }),

  /** Información general pública de una tienda por su enlace (no requiere sesión) */
  publicSummary: (token: string) =>
    apiRequest<PublicStoreSummary>(`/public/stores/${encodeURIComponent(token)}`, { method: 'GET' }),
};
