import { apiRequest } from './api';

export const LEAD_STAGES = [
  { id: 'nuevo', label: 'Nuevo', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  { id: 'contactado', label: 'Contactado', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { id: 'calificado', label: 'Calificado', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { id: 'propuesta', label: 'Propuesta', color: 'bg-[#FCCB34]/20 text-[#B08800] dark:text-[#FCCB34] border-[#FCCB34]/40' },
  { id: 'ganado', label: 'Ganado', color: 'bg-green-500/15 text-green-500 border-green-500/30' },
  { id: 'perdido', label: 'Perdido', color: 'bg-red-500/15 text-red-500 border-red-500/30' },
] as const;

export type LeadStage = typeof LEAD_STAGES[number]['id'];

export interface Lead {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  stage: LeadStage;
  estimatedValue?: number | string;
  notes?: string;
  lastContactAt?: string;
  origin: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadSummary {
  total: number;
  byStage: { stage: LeadStage; count: number; value: number }[];
  openValue: number;
  wonValue: number;
}

export interface CreateLeadDto {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  stage?: string;
  estimatedValue?: number;
  notes?: string;
  lastContactAt?: string;
}

export interface ImportResult {
  dryRun: boolean;
  detectedColumns: { field: string; header: string }[];
  ignoredHeaders: string[];
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  preview: {
    name: string;
    company?: string;
    email?: string;
    phone?: string;
    stage: LeadStage;
    action: 'nuevo' | 'actualiza' | 'omitido';
  }[];
}

export interface YavendioImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  byStage: Record<string, number>;
  sample: { name: string; stage: LeadStage; action: string }[];
}

export interface YavendioContactsResult {
  total: number;
  created: number;
  existing: number;
  skipped: number;
  sample: string[];
}

export const crmApi = {
  getLeads: (search?: string, stage?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (stage) params.set('stage', stage);
    const qs = params.toString();
    return apiRequest<Lead[]>(`/crm/leads${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  getSummary: () => apiRequest<LeadSummary>('/crm/summary', { method: 'GET' }),

  create: (dto: CreateLeadDto) =>
    apiRequest<Lead>('/crm/leads', { method: 'POST', body: JSON.stringify(dto) }),

  update: (id: string, dto: Partial<CreateLeadDto>) =>
    apiRequest<Lead>(`/crm/leads/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/crm/leads/${id}`, { method: 'DELETE' }),

  /** dryRun=true devuelve la vista previa sin guardar nada */
  import: (csvUrl: string, dryRun: boolean) =>
    apiRequest<ImportResult>('/crm/import', {
      method: 'POST',
      body: JSON.stringify({ csvUrl, dryRun }),
    }),

  /** Trae las conversaciones de la cuenta de Yavendió conectada.
   *  dryRun=true solo cuenta; skipEmpty deja fuera las que nunca
   *  tuvieron un mensaje. */
  importYavendio: (dryRun: boolean, skipEmpty: boolean) =>
    apiRequest<YavendioImportResult>('/crm/import/yavendio', {
      method: 'POST',
      body: JSON.stringify({ dryRun, skipEmpty }),
    }),

  /** Contactos de Yavendió como prospectos nuevos. Quien ya está en el CRM no se toca. */
  importYavendioContacts: (dryRun: boolean) =>
    apiRequest<YavendioContactsResult>('/crm/import/yavendio/contacts', {
      method: 'POST',
      body: JSON.stringify({ dryRun }),
    }),
};
