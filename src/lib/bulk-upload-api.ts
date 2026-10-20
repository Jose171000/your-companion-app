import { apiRequest, apiRequestMultipart, apiDownload } from './api';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface BulkUploadResponse {
  jobId?: string;
  message: string;
  accepted?: number;
  totalQueued?: number;
  totalSkipped?: number;
  /** Una línea por fila rechazada, con su motivo. */
  rejectedDetails?: string[];
}

export interface BulkUploadStatus {
  status: string;
  total?: number;
  processed?: number;
  failed?: number;
  errors?: string[];
}

// ─────────────────────────────────────────────
// Bulk Upload API
// ─────────────────────────────────────────────

export const bulkUploadApi = {
  /** Plantilla de Excel para la creación masiva de productos. */
  downloadProductTemplate: () => apiDownload('/bulk-upload/products/template', 'plantilla-productos.xlsx'),

  /**
   * Carga masiva de productos via Excel + ZIP opcional de imágenes.
   * Columnas Excel: sku | precio | stock | fotos | nombre | descripcion | canales (solo JPG)
   */
  uploadProducts: (excelFile: File, zipFile?: File) => {
    const form = new FormData();
    form.append('excel', excelFile);
    if (zipFile) form.append('zip', zipFile);
    return apiRequestMultipart<BulkUploadResponse>('/bulk-upload/products', form);
  },

  /**
   * Edición masiva de productos via Excel.
   * Columnas: sku (obligatorio) | name | description | price | stock | category | subCategory | targetMarketplaces
   */
  editProducts: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiRequestMultipart<BulkUploadResponse>('/bulk-upload/products/edit', form);
  },

  /** Estado de la cola de edición masiva de productos */
  getProductEditStatus: () =>
    apiRequest<BulkUploadStatus>('/bulk-upload/products/edit/status', { method: 'GET' }),

  /**
   * [ADMIN] Carga masiva de categorías via Excel.
   * Columnas: marketplace | categoryId | name | labelText | requiredAttributes (JSON)
   */
  uploadCategories: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiRequestMultipart<BulkUploadResponse>('/bulk-upload/categories', form);
  },

  /** [ADMIN] Estado de la cola de carga masiva de categorías */
  getCategoryQueueStatus: () =>
    apiRequest<BulkUploadStatus>('/bulk-upload/categories/status', { method: 'GET' }),

  /**
   * [ADMIN] Edición masiva de categorías via Excel.
   * Columnas identificadoras: categoryId | marketplace
   */
  editCategories: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiRequestMultipart<BulkUploadResponse>('/bulk-upload/categories/edit', form);
  },

  /** [ADMIN] Estado de la cola de edición masiva de categorías */
  getCategoryEditStatus: () =>
    apiRequest<BulkUploadStatus>('/bulk-upload/categories/edit/status', { method: 'GET' }),
};
