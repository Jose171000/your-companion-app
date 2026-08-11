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
  createdAt: string;
  profile: ClientProfile | null;
  stats: ClientStats;
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
  /** Todos los clientes con estadísticas de uso y pagos */
  getClients: () => apiRequest<AdminClient[]>('/admin/clients', { method: 'GET' }),

  /** Detalle de un cliente con su historial de pagos */
  getClient: (id: string) => apiRequest<ClientDetail>(`/admin/clients/${id}`, { method: 'GET' }),

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
};

// ─────────────────────────────────────────────
// Reports API (cliente ve sus propias ventas)
// ─────────────────────────────────────────────

export interface SalesReport {
  range: { from: string; to: string };
  totals: { sales: number; orders: number; avgTicket: number };
  byDay: { date: string; sales: number; orders: number }[];
  byChannel: { channel: string; sales: number; orders: number; source: string }[];
  sources: { marketplaces: boolean; sheets: boolean; sheetError: string | null };
}

export const reportsApi = {
  getSales: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return apiRequest<SalesReport>(`/reports/sales${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },
};
