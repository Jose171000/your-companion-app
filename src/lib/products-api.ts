import { apiRequest, apiRequestMultipart, apiDownload } from './api';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ProductImage {
  id: string;
  url: string;
  order: number;
}

/** Lo que la IA identificó en las fotos del producto. */
export interface AiVision {
  productType: string;
  suggestedName: string;
  description: string;
  brand: string | null;
  color: string | null;
  material: string | null;
  gender: string | null;
  confidence: number;
}

/** Datos obligatorios de un canal que la IA no pudo deducir. */
export interface MissingAttribute {
  name: string;
  description: string;
  options?: string[];
}

export interface AiReport {
  vision: AiVision | null;
  missingAttributes: Record<string, MissingAttribute[]>;
}

export interface Product {
  /** Solo viene al crear con IA: lo que se vio en las fotos y lo que falta. */
  aiReport?: AiReport;
  /** Datos de envío que exige Falabella. Nulos hasta que se completan. */
  packageWidth?: number | null;
  packageLength?: number | null;
  packageHeight?: number | null;
  packageWeight?: number | null;
  /** Ids por canal, incluida la categoría de Falabella. */
  marketplaceIds?: Record<string, unknown> | null;
  id: string;
  sku: string;
  name: string;
  description: string;
  category?: string;
  subCategory?: string;
  price?: number;
  stock?: number;
  targetMarketplaces: string[];
  images: ProductImage[];
  tone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedProducts {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateProductDto {
  sku: string;
  name: string;
  description: string;
  category?: string;
  subCategory?: string;
  price?: number;
  stock?: number;
  targetMarketplaces?: string[];
  images?: string[]; // URLs
  tone?: string;
}

export interface CreateProductWithAiDto {
  sku: string;
  /** Opcionales: si faltan, la IA los deduce de las fotos. */
  name?: string;
  description?: string;
  category?: string;
  subCategory?: string;
  price?: number;
  stock?: number;
  targetMarketplaces?: string[];
  images?: string[]; // URLs
  tone?: string;
}

export type UpdateProductDto = Partial<CreateProductDto>;

export interface ProductsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  marketplace?: string;
  category?: string;
  subCategory?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'createdAt' | 'name' | 'price' | 'stock' | 'sku';
  order?: 'asc' | 'desc';
}

export interface GenerateAIContentDto {
  targetMarketplaces?: string[];
  tone?: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function buildQueryString(params: ProductsQueryParams): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

// ─────────────────────────────────────────────
// Products API
// ─────────────────────────────────────────────

export const productsApi = {
  /** Listar productos con filtros y paginación */
  findAll: (params: ProductsQueryParams = {}) =>
    apiRequest<PaginatedProducts>(`/products${buildQueryString(params)}`, {
      method: 'GET',
    }),

  /** Obtener un producto por ID */
  findOne: (id: string) =>
    apiRequest<Product>(`/products/${id}`, { method: 'GET' }),

  /** Crear producto sin IA — imágenes como URLs */
  create: (dto: CreateProductDto) =>
    apiRequest<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  /** Crear producto sin IA — imágenes como archivos físicos */
  createWithFiles: (dto: Omit<CreateProductDto, 'images'>, images: File[]) => {
    const form = new FormData();
    form.append('data', new Blob([JSON.stringify(dto)], { type: 'application/json' }));
    images.forEach((file) => form.append('images', file));
    return apiRequestMultipart<Product>('/products/with-files', form);
  },

  /** Crear producto con IA — imágenes como URLs */
  createWithAI: (dto: CreateProductWithAiDto) =>
    apiRequest<Product>('/products/with-ai', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  /** Crear producto con IA — imágenes como archivos físicos */
  createWithAIAndFiles: (dto: Omit<CreateProductWithAiDto, 'images'>, images: File[]) => {
    const form = new FormData();
    form.append('data', new Blob([JSON.stringify(dto)], { type: 'application/json' }));
    images.forEach((file) => form.append('images', file));
    return apiRequestMultipart<Product>('/products/with-ai/with-files', form);
  },

  /** Actualizar campos de un producto */
  update: (id: string, dto: UpdateProductDto) =>
    apiRequest<Product>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  /** Generar contenido IA para un producto ya existente */
  generateAI: (id: string, dto: GenerateAIContentDto = {}) =>
    apiRequest<Product>(`/products/${id}/generate-ai`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  /** Eliminar un producto */
  remove: (id: string) =>
    apiRequest<{ message: string }>(`/products/${id}`, { method: 'DELETE' }),

  /** Exportar catálogo completo */
  exportProducts: (format: 'json' | 'csv' | 'xlsx', params: ProductsQueryParams = {}) => {
    const { page, limit, sortBy, order, ...exportParams } = params;
    return apiDownload(`/export/products/${format}${buildQueryString(exportParams)}`, `productos.${format}`);
  },

  /** Exportar contenido generado por IA */
  exportAiContent: (format: 'json' | 'csv' | 'xlsx', params: ProductsQueryParams = {}) => {
    const { page, limit, sortBy, order, ...exportParams } = params;
    return apiDownload(`/export/ai-content/${format}${buildQueryString(exportParams)}`, `contenido-ia.${format}`);
  }
};

// ─────────────────────────────────────────────
// Legacy export — mantiene compatibilidad
// ─────────────────────────────────────────────
export interface ProductGenerationRequest {
  marketplaces: string[];
  category: string;
  productInfo: string;
}

export interface GeneratedProductData {
  title: string;
  description: string;
  attributes: Record<string, string>;
}
