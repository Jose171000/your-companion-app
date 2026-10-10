import { apiRequest } from './api';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ClientProfile {
  id: string;
  ruc?: string;
  businessName?: string;
  fiscalAddress?: string;
  clientType: 'agency' | 'saas';
  status: 'activo' | 'pausado' | 'perdido';
  contactName?: string;
  contactPhone?: string;
  sheetCsvUrl?: string;
  reportEmbedUrl?: string;
  reportEmbedTitle?: string;
  notes?: string;
}

export interface ClientStats {
  products: number;
  publishedListings: number;
  connectedMarketplaces: string[];
  totalPaid: number;
  lastPaymentAt: string | null;
}

export interface AdminClient {
  id: string;
  name: string;
  lastName: string;
  email: string;
  nameCompany?: string;
  cellPhone?: string;
  role: string;
  isActive: boolean;
  /** null o vacío = acceso completo */
  allowedSections?: string[] | null;
  createdAt: string;
  profile: ClientProfile | null;
  stats: ClientStats;
}

/**
 * Secciones que el superadmin puede conceder o restringir.
 *
 * La lista NO se escribe aquí: se pide al servidor, que es donde vive la
 * única definición. Así, al añadir un módulo nuevo aparece solo en la
 * pantalla de permisos y no hay forma de olvidarse de él.
 */
export interface AppSectionDef {
  id: string;
  label: string;
  always: boolean;
}

export interface CreateClientDto {
  /** "contador" solo accede a finanzas y facturación */
  role?: "user" | "contador";
  name: string;
  lastName: string;
  email: string;
  password: string;
  nameCompany?: string;
  cellPhone?: string;
  allowedSections?: string[];
  clientType?: "agency" | "saas";
}

export interface UpdateAccessDto {
  allowedSections?: string[];
  isActive?: boolean;
}

export interface Payment {
  id: string;
  amount: number | string;
  currency: string;
  type: 'unico' | 'recurrente';
  frequency?: string;
  concept: string;
  method?: string;
  paidAt: string;
  receiptRef?: string;
  notes?: string;
  createdAt: string;
}

export interface ClientDetail extends Omit<AdminClient, 'stats'> {
  payments: Payment[];
}

export interface FinanceSummary {
  totalCollected: number;
  monthCollected: number;
  mrr: number;
  activeClients: number;
  totalClients: number;
  monthlyIncome: { month: string; total: number }[];
}

export interface CreatePaymentDto {
  amount: number;
  currency?: string;
  type: 'unico' | 'recurrente';
  frequency?: string;
  concept: string;
  method?: string;
  paidAt: string;
  notes?: string;
}

export type UpdateClientProfileDto = Partial<Omit<ClientProfile, 'id'>>;

// ─────────────────────────────────────────────
// Admin API
// ─────────────────────────────────────────────

export const adminApi = {
  /** Secciones sobre las que se puede dar o quitar acceso (definidas en el servidor) */
  getSections: () => apiRequest<AppSectionDef[]>('/admin/sections', { method: 'GET' }),

  /** Todos los clientes con estadísticas de uso y pagos */
  getClients: () => apiRequest<AdminClient[]>('/admin/clients', { method: 'GET' }),

  /** Detalle de un cliente con su historial de pagos */
  getClient: (id: string) => apiRequest<ClientDetail>(`/admin/clients/${id}`, { method: 'GET' }),

  /** Crea una cuenta con contraseña inicial y permisos de sección */
  createClient: (dto: CreateClientDto) =>
    apiRequest<AdminClient>('/admin/clients', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  /** Define a qué secciones accede el usuario y si su cuenta está activa */
  updateAccess: (id: string, dto: UpdateAccessDto) =>
    apiRequest<AdminClient>(`/admin/clients/${id}/access`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  /** Asigna una contraseña nueva. Sin newPassword, el servidor genera una. */
  resetPassword: (id: string, newPassword?: string) =>
    apiRequest<{ message: string; password: string }>(`/admin/clients/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(newPassword ? { newPassword } : {}),
    }),

  /** Elimina la cuenta y todos sus datos */
  deleteClient: (id: string) =>
    apiRequest<{ message: string }>(`/admin/clients/${id}`, { method: 'DELETE' }),

  /** Crea o actualiza el perfil comercial del cliente */
  updateProfile: (id: string, dto: UpdateClientProfileDto) =>
    apiRequest<ClientProfile>(`/admin/clients/${id}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  /** Registra un pago */
  addPayment: (id: string, dto: CreatePaymentDto) =>
    apiRequest<Payment>(`/admin/clients/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  /** Elimina un pago registrado por error */
  removePayment: (paymentId: string) =>
    apiRequest<{ message: string }>(`/admin/payments/${paymentId}`, { method: 'DELETE' }),

  /** Panel financiero */
  getFinanceSummary: () =>
    apiRequest<FinanceSummary>('/admin/finance/summary', { method: 'GET' }),

  /** Comprueba si una URL se puede mostrar embebida antes de guardarla */
  checkEmbeddable: (url: string) =>
    apiRequest<{
      embeddable: boolean;
      status: number | null;
      xFrameOptions: string | null;
      frameAncestors: string | null;
      reason: string | null;
    }>(`/admin/embed-check?url=${encodeURIComponent(url)}`, { method: 'GET' }),
};

// ─────────────────────────────────────────────
// Reports API (cliente ve sus propias ventas)
// ─────────────────────────────────────────────

export interface SalesReport {
  range: { from: string; to: string };
  totals: { sales: number; orders: number; avgTicket: number };
  byDay: { date: string; sales: number; orders: number }[];
  byChannel: { channel: string; sales: number; orders: number; source: string }[];
  /** Desglose por cuenta del canal: una tienda puede tener varias del mismo marketplace */
  byAccount?: { connectionId: string | null; channel: string; label: string | null; sales: number; orders: number }[];
  /** Cuándo entró la última venta de la tienda */
  lastOrderAt?: string | null;
  sources: { marketplaces: boolean; sheets: boolean; sheetError: string | null };
}

export interface ReportConfig {
  embedUrl: string | null;
  embedTitle: string;
}

export const reportsApi = {
  /** Reporte externo que el admin configuró para este usuario */
  getConfig: () => apiRequest<ReportConfig>('/reports/config', { method: 'GET' }),

  getSales: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return apiRequest<SalesReport>(`/reports/sales${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },
};
