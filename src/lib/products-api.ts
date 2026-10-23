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
  /** Lo que la IA estimó en vez de leerlo del cliente. */
  estimated?: { measures: boolean; attributes: Record<string, string[]> } | null;
}

export interface Product {
  aiAttributes?: Record<string, any> | null;
  /** Solo viene al crear con IA: lo que se vio en las fotos y lo que falta. */
  aiReport?: AiReport;
  /** Datos de envío que exige Falabella. Nulos hasta que se completan. */
  packageWidth?: number | null;
  packageLength?: number | null;
  packageHeight?: number | null;
  packageWeight?: number | null;
  /** Ids por canal, incluida la categoría de Falabella. */
  marketplaceIds?: Record<string, unknown> | null;
  /** Grupo de variantes al que pertenece (si lo tiene) y los valores de esta variante */
  group?: { id: string; name: string; parentSku: string; axes: { name: string; values: string[] }[] } | null;
  variantValues?: Record<string, string> | null;
  /** Solo en la lista: resumen de todas las variantes del grupo (la lista muestra un grupo como una sola fila) */
  groupSummary?: { variantCount: number; priceMin: number | null; priceMax: number | null; stockTotal: number; variantIds: string[] } | null;
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

/** Categoría real, estado real en cada canal y qué falta para publicar (lo calcula el servidor con las reglas de publicación). */
export interface ProductOverview {
  categories: {
    falabella: { id: string; path: string | null } | null;
    mercadolibre: { id: string } | null;
    internal: string | null;
  };
  channels: { linkId: string; marketplace: string; channel: string; account: string | null; status: string; statusLabel: string; error: string | null; permalink: string | null }[];
  completeness: { ready: boolean; missing: string[]; byChannel: Record<string, { ready: boolean; missing: string[] }> };
}

export interface ProductsSummary {
  total: number;
  sinCategoria: number;
  sinPublicar: number;
  conError: number;
  incompletos: number;
}

/** Lo que responde el servidor: los productos y, aparte, los datos de la paginación (`meta`). */
export interface PaginatedProducts {
  data: Product[];
  meta?: { total: number; page: number; limit: number; totalPages: number; hasNextPage?: boolean; hasPreviousPage?: boolean };
  /** Formato antiguo, por si algún servidor lo manda así */
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
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
  estado?: 'sin-categoria' | 'sin-publicar' | 'con-error' | 'incompletos';
  /** Pide las variantes de un grupo en vez de una sola fila por grupo */
  groupId?: string;
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

  /** Cuántos productos de la tienda hay en cada situación */
  summary: () => apiRequest<ProductsSummary>('/products/summary', { method: 'GET' }),

  /** Categoría real, estado en cada canal y qué falta, de los productos indicados */
  overview: (ids: string[]) =>
    apiRequest<Record<string, ProductOverview>>(`/products/overview?ids=${ids.join(',')}`, { method: 'GET' }),

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
