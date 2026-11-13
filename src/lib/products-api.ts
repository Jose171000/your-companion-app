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
  /** Solo en el cliente: la acción se pidió desde la fila del grupo y vale para TODAS sus variantes (`id` es el de una de ellas). */
  alGrupo?: boolean;
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
    ripley?: { id: string; path: string | null } | null;
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

/** Lo que devuelve la IA al preparar un producto para Ripley (no se envía nada a Ripley). */
export interface RipleyPreview {
  guardado: boolean;
  categoria: { id: string | null; ruta: string | null; confianza: 'alta' | 'baja' | 'ninguna' | 'elegida'; motivo: string | null };
  contenido: { name?: string; shortDescription?: string; description?: string; brand?: string };
  descripcionEsHtml: boolean;
  marca: { valor: string; valida: boolean; canonica: string | null; sugerencias: string[]; listaCargada: boolean } | null;
  atributos: Record<string, string>;
  faltantes: { name: string; description: string; options?: string[] }[];
}

/** Cómo llega un valor de Synkro a la lista del canal: igual, aproximado, ajustado (IA o persona) o sin equivalente. */
export type EstadoDeValor = 'exacto' | 'aproximado' | 'ajustado' | 'sin';

/** Lo que se enviará al canal por cada valor de un eje, en un dato del canal (un color puede ir en «Color» y en «Color básico»). */
export interface DetalleDeEje {
  eje: string;
  atributo: string;
  atributoId: string;
  /** Dato de la misma clase que el principal: su opción se deduce de la del principal. */
  derivado: boolean;
  opciones: string[];
  items: { valor: string; opcion: string | null; estado: EstadoDeValor }[];
}

/** Resultado de revisar si las variantes de un grupo caben en una sola publicación de un canal. */
export interface VariantCompatResult {
  canal: string;
  nombreDelCanal: string;
  categoryId: string | null;
  ruta: string | null;
  publicaComo: 'una' | 'separadas';
  mapeo: { eje: string; atributo: string }[];
  ejesNoPermitidos: string[];
  /** Datos de variante del canal que ningún eje del producto usa: a qué se podría renombrar un eje que el canal no acepta. */
  ejesDisponibles?: string[];
  /** Renombres que la IA recomienda (uno por eje no aceptado). La persona solo confirma; nada se cambia solo. */
  renombresSugeridos?: { eje: string; a: string }[];
  ejesQueFaltan: string[];
  valoresSinEquivalente: { eje: string; valores: string[] }[];
  /** Qué saldrá en el canal por cada valor de cada eje (también cuando todo está bien). */
  detalle?: DetalleDeEje[];
  /** Valores distintos que el canal llevaría a la misma opción (dos variantes con el mismo dato). */
  colisiones?: { eje: string; atributo: string; opcion: string; valores: string[] }[];
  avisos: string[];
  /** Otra categoría, parecida y verificada, que sí admite las variantes: solo una recomendación. */
  recomendada?: { id: string; ruta: string } | null;
}

/** Valores de un dato del canal (color, talla, tamaño) que no encajan, con la opción válida que propone la IA para cada uno. La persona confirma. */
export interface SugerenciaDeAjustes {
  eje: string;
  atributo: string;
  opciones: string[];
  items: { valor: string; opcion: string | null; motivo: string; origen: 'ia' | 'foto' | 'actual' | null; conflicto: boolean }[];
  /** Dato de la misma clase que el principal («Color básico»): su ajuste es propio. */
  derivado?: boolean;
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

  /** Guarda lo común de un grupo de variantes en todas a la vez (descripción, categoría, subcategoría, marketplaces destino) */
  updateGroup: (groupId: string, dto: { description?: string; category?: string; subCategory?: string; targetMarketplaces?: string[] }) =>
    apiRequest<{ saved: boolean; variantes: number }>(`/products/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  /** Generar contenido IA para un producto ya existente */
  generateAI: (id: string, dto: GenerateAIContentDto = {}) =>
    apiRequest<Product>(`/products/${id}/generate-ai`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  /** La IA prepara el producto para Ripley (categoría verificada, contenido y atributos). `guardar: false` es solo vista previa. */
  prepareRipley: (id: string, guardar = false, alGrupo = false) =>
    apiRequest<RipleyPreview>(`/products/${id}/prepare-ripley`, {
      method: 'POST',
      body: JSON.stringify({ guardar, alGrupo }),
    }),

  /** ¿Caben las variantes del grupo en UNA publicación de cada canal? Si no, se publican separadas (y puede venir una categoría recomendada). Solo consulta. */
  variantCompat: (groupId: string, marketplaces: string[], categoryId?: string) =>
    apiRequest<VariantCompatResult[]>(
      `/products/groups/${groupId}/variant-compat?marketplace=${encodeURIComponent(marketplaces.join(','))}${categoryId ? `&categoryId=${encodeURIComponent(categoryId)}` : ''}`,
      { method: 'GET' },
    ),

  /** La IA propone a qué opción válida de un canal corresponde cada color/talla/tamaño que su lista no tiene. Solo consulta. */
  suggestChannelValues: (groupId: string, marketplace: string) =>
    apiRequest<SugerenciaDeAjustes[]>(`/products/groups/${groupId}/channel-values/suggest`, { method: 'POST', body: JSON.stringify({ marketplace }) }),

  /** Guarda, solo para ese canal, a qué opción corresponde cada valor confirmado. El valor de la persona no cambia en Synkro ni en otros canales. */
  applyChannelValues: (groupId: string, marketplace: string, cambios: { eje: string; valor: string; opcion: string; atributo?: string }[]) =>
    apiRequest<{ aplicados: number; variantes: number }>(`/products/groups/${groupId}/channel-values/apply`, { method: 'POST', body: JSON.stringify({ marketplace, cambios }) }),

  /** Cambia el NOMBRE de un eje de variación del grupo («Talla» → «Tamaño cama») en el grupo y en todas sus variantes; los valores no se tocan. */
  renameGroupAxis: (groupId: string, from: string, to: string) =>
    apiRequest<{ eje: string; variantes: number }>(`/products/groups/${groupId}/axes`, { method: 'PATCH', body: JSON.stringify({ from, to }) }),

  /** «Llenar atributos»: con la categoría de Ripley ya elegida, la IA devuelve solo los atributos VACÍOS (no cambia la categoría ni pisa lo escrito). No guarda. */
  fillRipleyAttributes: (id: string, body: { categoryId: string; actuales: Record<string, string>; alGrupo?: boolean }) =>
    apiRequest<{ values: Record<string, string>; estimated: string[]; filled: number; total: number; sinEquivalente: string[]; sinValor: string[] }>(
      `/products/${id}/ripley/fill-attributes`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  /** Regenerar con IA el contenido de un producto con variantes: UNA sola vez para todo el grupo */
  generateGroupAI: (groupId: string, dto: GenerateAIContentDto = {}) =>
    apiRequest<{ variantes: number; titulo: string | null }>(`/products/groups/${groupId}/generate-ai`, {
      method: 'POST',
      body: JSON.stringify({ targetMarketplaces: dto.targetMarketplaces, tone: dto.tone }),
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
