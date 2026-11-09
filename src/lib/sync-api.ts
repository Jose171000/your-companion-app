import { apiRequest, apiRequestMultipart, apiDownload } from './api';
import type { SaleState } from './sale-status';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface MarketplaceConnection {
  id: string;
  marketplace: string;
  /** Nombre con el que la tienda distingue esta cuenta de otras del mismo canal */
  label?: string | null;
  externalUserId: string;
  externalNickname?: string;
  expiresAt: string;
  status: 'active' | 'revoked' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface ListingInfo {
  marketplace: string;
  /** Cuenta del canal en la que está publicada */
  connectionId?: string | null;
  accountLabel?: string | null;
  externalId: string;
  permalink?: string;
  syncStatus: 'pending' | 'published' | 'paused' | 'error' | 'removed';
  /** Pausada por el usuario desde Synkro (en Falabella el canal la sigue mostrando activa, con stock 0) */
  pausedByUser?: boolean;
  lastStockSynced?: number;
  lastPriceSynced?: number;
  lastSyncedAt?: string;
  lastError?: string;
}

export type ChannelActionType = 'pause' | 'resume' | 'remove';

export interface ChannelActionResult {
  message: string;
  results: { linkId: string; marketplace: string; account: string | null; ok: boolean; message: string }[];
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
  /** Moneda del canal (PEN, USD...) */
  currency?: string;
  /** Precio regular y, si hay promoción vigente, el precio con descuento del canal */
  regularPrice?: number | string | null;
  salePrice?: number | string | null;
  /** Cuenta del canal en la que está publicada y su nombre */
  connectionId?: string | null;
  accountLabel?: string | null;
  /** Imagen de esta publicación (cada variante tiene la suya) */
  imageUrl?: string | null;
  variation?: string | null;
  parentSku?: string | null;
  /** Variantes de un producto de Synkro: el tablero las junta bajo su grupo */
  groupId?: string | null;
  groupName?: string | null;
  groupCode?: string | null;
  variantValues?: Record<string, string> | null;
  /** Precio con descuento de la tienda web (futura conexión WooCommerce) */
  webPrice?: number | string | null;
  /** Promoción del producto en los marketplaces (precio con descuento y fechas AAAA-MM-DD) */
  promo?: { price: number | string | null; start: string | null; end: string | null } | null;
  productId: string;
  productName: string;
  sku: string;
  stock: number;
  price: number | string;
}

/** Una línea de una venta: lo vendido, a qué precio y cómo quedó el stock. */
export interface SaleLine {
  sku: string | null;
  title: string;
  quantity: number;
  /** Lo que pagó el cliente por unidad */
  unitPrice: number;
  listPrice?: number | null;
  shippingAmount?: number | null;
  status?: string | null;
  trackingCode?: string | null;
  carrier?: string | null;
  shippingType?: string | null;
  productId?: string | null;
  /** Stock que había antes y el que quedó después de esta venta */
  stockBefore?: number | null;
  stockAfter?: number | null;
  /** La venta se canceló o devolvió y esta línea ya devolvió su stock */
  repuesto?: boolean | null;
  /** La venta se canceló o devolvió después de enviarse: el stock espera a que el producto vuelva */
  porReponer?: boolean | null;
  /** Stock de ahora y foto del producto (null si ya no está en el catálogo) */
  currentStock: number | null;
  imageUrl: string | null;
  productName: string | null;
  /** Qué variante se vendió: «Color: Rojo · Talla: M» */
  variant?: string | null;
}

export interface SaleDetails {
  customer: { name: string | null; email: string | null; phone: string | null; document: string | null; nickname?: string | null };
  shipping: {
    method: string | null; status: string | null; trackingCode: string | null; carrier: string | null;
    shipBy: string | null; deliveryBy: string | null;
    address: { line: string | null; city: string | null; region: string | null; country: string | null; postalCode: string | null; receiver: string | null; notes: string | null };
  };
  payment: { method: string | null; status: string | null; paidAmount: number | null; installments: number | null; approvedAt: string | null };
  notes: string | null;
  channelStatus: string | null;
}

export interface Sale {
  id: string;
  marketplace: string;
  externalId: string;
  orderNumber: string;
  account: { id: string; label: string } | null;
  orderDate: string;
  status: string;
  /** Estado común a todos los canales */
  saleState?: SaleState;
  /** true si esta persona no tiene «costos.ver»: envío y cupones vienen vacíos */
  costsHidden?: boolean;
  /** Lo que pagó el comprador por el envío */
  shippingPaid?: number;
  /** Quién pagó el envío: comprador, gratis (no pagó el comprador), retiro (sin envío) o sin_dato */
  shippingType?: 'comprador' | 'gratis' | 'retiro' | 'sin_dato';
  /** Lo que te costó el envío, si el canal lo informa */
  shippingSellerCost?: number | null;
  /** Cupones y descuentos del canal al comprador */
  discountAmount?: number;
  discountSellerFunded?: number | null;
  /** Registrada a mano o desde Excel: la única que se puede editar o eliminar */
  manual?: boolean;
  /** Datos para precargar la edición (solo el dueño, solo en el detalle de una venta manual) */
  manualEdit?: ManualSaleEdit;
  customerName: string | null;
  /** Fecha máxima para despachar */
  shipByDate: string | null;
  totalAmount: number;
  currency: string;
  itemsCount: number;
  shipping: { status: string | null; method: string | null } | null;
  lines: SaleLine[];
  details?: SaleDetails | null;
}

/** Un producto del catálogo para elegir en una venta manual */
export interface ManualSaleProduct {
  sku: string;
  name: string;
  variant: string | null;
  price: number | null;
  stock: number;
  imageUrl: string | null;
}

/** Lo que el formulario necesita para editar una venta manual */
export interface ManualSaleEdit {
  canal: string;
  fecha: string;
  numeroPedido: string;
  estado: string;
  envio: number;
  /** Envío que cubriste tú (envío gratis para el comprador) */
  envioCubierto: number;
  cliente: string;
  telefono: string;
  documento: string;
  direccion: string;
  notas: string;
  moneda: string;
  lineas: { sku: string; cantidad: number; precio: number; descontar: boolean; producto: ManualSaleProduct }[];
}

export interface ManualSalesResult {
  registradas: number;
  /** Una línea por venta o fila que no se registró, con el motivo */
  rechazadas: string[];
}

export interface SalesQuery {
  from?: string;
  to?: string;
  marketplace?: string;
  connectionId?: string;
  search?: string;
  /** Estados separados por coma: pendiente,enviado,entregado,cancelado,devuelto */
  status?: string;
  /** Cómo se pagó el envío, separados por coma: comprador,gratis,retiro,sin_dato */
  shipping?: string;
  limit?: number;
  offset?: number;
}

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'sent' | 'error' | 'skipped';

export interface ChangeRequest {
  id: string;
  marketplace: string;
  connection?: { id: string; label?: string | null; externalNickname?: string | null } | null;
  /** «promo»: un descuento por canal; el valor viaja como «precio|desde|hasta» o «quitar» */
  field: 'price' | 'stock' | 'promo';
  previousValue: string | null;
  newValue: string;
  status: ChangeRequestStatus;
  resultMessage: string | null;
  createdAt: string;
  resolvedAt: string | null;
  product: { id: string; name: string; sku: string };
}

export interface UpdateInventoryDto {
  stock?: number;
  price?: number;
}

// ─────────────────────────────────────────────
// Sync API
// ─────────────────────────────────────────────

/** Un canal donde el producto está publicado, con lo que se le envía. */
export interface SheetChannel {
  marketplace: string;
  connectionId: string;
  account: string;
  status: string;
  lastError: string | null;
  permalink: string | null;
  sent: Record<string, any>;
  listo: boolean;
  motivo?: string;
}

/** Precio y descuento de un producto en una cuenta de un canal. */
export interface SheetPrice {
  marketplace: string;
  connectionId: string;
  account: string;
  productPrice: number | null;
  productSalePrice: number | null;
  /** Lo que se envía a ese canal y de dónde sale: propio del canal, del producto, o lo que el canal ya tiene. */
  sent: { price: number; salePrice: number | null; saleStart: string | null; saleEnd: string | null; origin: { price: 'propio' | 'producto' | 'canal'; promo: 'propio' | 'producto' | 'canal' | null } };
  /** Lo fijado solo para este canal; vacío usa el del producto. */
  own: { price: number | null; salePrice: number | null; saleStart: string | null; saleEnd: string | null };
  /** Lo que el canal muestra hoy. */
  channel: { price: number | null; salePrice: number | null; stock: number | null };
  stock: number;
  canSetSale: boolean;
}

export interface SheetData {
  product: {
    id: string;
    sku: string;
    name: string;
    description: string;
    /** Canal del que se importó el producto; nulo si se creó en Synkro. */
    importedFrom: string | null;
    aiTitle: string | null;
    aiDescription: string | null;
    descriptionHtml: string | null;
    /** Quién escribió cada campo: la IA o el canal del que se importó. Sin etiqueta, una persona. */
    origin?: Partial<Record<'aiTitle' | 'aiDescription' | 'descriptionHtml' | 'brand', 'ia' | 'canal'>>;
    brand: string | null;
    color: string | null;
    price: number | null;
    stock: number;
    images: string[];
    measures: { width: number | null; length: number | null; height: number | null; weight: number | null; estimated: boolean };
  };
  channels: SheetChannel[];
  prices: SheetPrice[];
}

export interface FalabellaField {
  name: string;
  label: string;
  description?: string;
  inputType: string;
  options: string[];
  /** Obligatorio. Los demás son opcionales pero suben la calidad del contenido en Falabella. */
  required?: boolean;
}

export interface LaunchReport {
  channels: { marketplace: string; accounts: number; status: 'encolado' | 'preparado' | 'omitido' | 'error'; message: string }[];
  falabella?: FalabellaPrepReport;
  /** Las variantes (o el producto) tal como saldrían, con su título en cada canal: para revisarlo antes de confirmar. */
  variants?: { id: string; sku: string; etiqueta: string | null; price: number | null; stock: number | null; titulos: { mercadolibre?: string; falabella?: string } }[];
  estimatedMeli: string[];
  /** Categoría de Mercado Libre con la que sale el producto; sin `id`, `options` son las recomendadas para elegir. */
  meliCategory?: { id?: string; path?: string; options?: { id: string; path: string }[] };
}

export interface FalabellaPrepReport {
  listo: boolean;
  motivo?: string;
  category: { id: string; path: string; auto: boolean; /** alta: verificada; baja: conviene revisarla; manual: la eligió una persona */ confidence?: 'alta' | 'baja' | 'manual' } | null;
  /** Por qué la categoría necesita revisión, si la necesita. */
  categoryNote?: string;
  brand: { value: string; replaced: boolean; original?: string };
  measures: { width: number | null; length: number | null; height: number | null; weight: number | null; estimated: boolean };
  estimatedAttributes: string[];
  /** La IA redactó la descripción HTML estándar en este paso. */
  descriptionGenerated?: boolean;
  /** Atributos de la categoría con valor, de cuántos hay. */
  attributes?: { filled: number; total: number };
}

export interface FalabellaPreparation {
  categoryId: string;
  packageWidth: number;
  packageLength: number;
  packageHeight: number;
  packageWeight: number;
  attributes?: Record<string, string>;
}

export interface FalabellaImportSummary {
  /** Mercado Libre: publicaciones leídas (cada una puede dar varias filas por variante) */
  publicaciones?: number;
  /** Mercado Libre: publicaciones o variantes sin SKU, que no se pueden enlazar */
  sinSku?: number;
  /** Mercado Libre: qué publicaciones tienen algo sin SKU (para corregirlo allá) */
  sinSkuDetalle?: { externalId: string; titulo: string; enlace: string | null; sinSku: number; total: number }[];
  /** Mercado Libre: cuántos SKU generó Synkro (si se pidió) */
  skuGenerados?: number;
  total: number;
  yaEnCatalogo: number;
  nuevas: number;
  enlazadas: number;
  /** Fichas cuyo SKU ya existe en otra tienda tuya: no se tocan */
  enOtraTienda?: number;
  incompleto: boolean;
  porEstado: Record<string, number>;
  notaMedia: number | null;
  ejemplos: { sku: string; nombre: string; estado: string; nota: number | null; enCatalogo: boolean }[];
  /** Mercado Libre: publicaciones repetidas (mismo SKU en la misma cuenta). No son variantes: solo la principal se enlaza. */
  duplicadas?: number;
  duplicados?: {
    sku: string;
    publicaciones: {
      externalId: string; variationId: string | null; titulo: string; estado: string; precio: number | null; stock: number; vendidas: number;
      permalink: string | null; imagen: string | null; tipo: string | null; sincronizadaCon: string | null; principal: boolean;
    }[];
  }[];
  /** Falabella: fichas que son variantes de un mismo producto (mismo ParentSku) y cómo quedan agrupadas */
  variantes?: {
    grupos: number;
    variantes: number;
    ejemplos: { parentSku: string; nombre: string; ejes: { name: string; values: string[] }[]; variantes: number }[];
    sinResolver: {
      parentSku: string;
      skus: string[];
      motivo: string;
      /** Dirección de la publicación en el canal y su título, cuando no hay nada que estructurar aquí (por ejemplo, variaciones sin SKU) */
      enlace?: string | null;
      titulo?: string;
      /** Las fichas de la familia, para estructurarlas a mano */
      fichas?: { sku: string; nombre: string; imagen?: string | null }[];
      /** Lo que propuso la IA y no se pudo comprobar: sirve de punto de partida */
      sugerencia?: { ejes: string[]; valores: Record<string, Record<string, string>>; motivo: string };
    }[];
    /** Segundo recurso: la IA propone los ejes y se comprueban contra los datos de cada ficha */
    ia?: { intentadas: number; resueltas: number; pendientes: number };
    /** Lectura de la página pública de Falabella para las familias que los atributos no resolvieron */
    paginaPublica?: { familias: number; leidas: number; resueltas: number; bloqueada: boolean; pendientes: number; sinDatos: { parentSku: string; motivo: string }[] };
    /** Familias que ya estaban agrupadas en Synkro: no se vuelven a proponer */
    yaAgrupadas?: number;
    aplicado: { gruposCreados: number; gruposActualizados: number; variantesAgrupadas: number; omitidos: { parentSku: string; motivo: string }[] } | null;
    /** Familias estructuradas a mano en la vista previa que se agruparon en esta misma importación */
    manuales?: { gruposCreados: number; gruposActualizados: number; variantesAgrupadas: number; omitidos: { parentSku: string; motivo: string }[] } | null;
  };
}

/** Una familia de variantes que la persona estructuró a mano: nombre, ejes y el valor de cada SKU. */
export interface GrupoManual {
  parentSku: string;
  name: string;
  axes: string[];
  variants: { sellerSku: string; values: Record<string, string> }[];
}

/** Una variante de Yavendió y el producto de Synkro con el que parece corresponder. */
export interface YavendioSugerencia {
  yavendioProductId: string;
  yavendioProductName: string;
  variantId: string;
  variantName: string;
  price: number | null;
  available: boolean;
  /** SKU del producto de Synkro al que ya está vinculada, si lo está. */
  vinculadaA: string | null;
  confianza: 'alta' | 'posible' | 'ninguna';
  sugerido: { productId: string; sku: string; name: string; motivo: string } | null;
  otras: { productId: string; sku: string; name: string; motivo: string }[];
  avisos: string[];
}

export interface YavendioVistaPrevia {
  totalVariantes: number;
  yaVinculadas: number;
  coincidenciasSeguras: number;
  coincidenciasPosibles: number;
  sinCoincidencia: number;
  variantes: YavendioSugerencia[];
}

export interface YavendioPedidosResultado {
  revisados: number;
  nuevos: number;
  actualizados: number;
  anulados: number;
  omitidos: number;
  pendientesPorTraer: number;
  lineasSinVincular: { pedido: string; producto: string; variantId: string | null }[];
}

export const syncApi = {
  /** Qué hay en Yavendió y con qué producto de Synkro parece corresponder cada variante. Solo lee. */
  yavendioPreviewProducts: (connectionId?: string) =>
    apiRequest<YavendioVistaPrevia>(
      `/sync/yavendio/import/products${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ''}`,
      { method: 'GET' },
    ),

  /** Vincula los pares que la persona confirmó. No escribe nada en Yavendió. */
  yavendioLinkProducts: (links: { productId: string; variantId: string }[], connectionId?: string) =>
    apiRequest<{ vinculadas: number; rechazadas: { variantId: string; motivo: string }[]; ventasCompletadas: number }>(
      '/sync/yavendio/import/products/link',
      { method: 'POST', body: JSON.stringify({ links, ...(connectionId ? { connectionId } : {}) }) },
    ),

  /** Trae los pedidos confirmados de Yavendió a las ventas. dryRun=true solo cuenta. */
  yavendioImportOrders: (dryRun: boolean, connectionId?: string) =>
    apiRequest<YavendioPedidosResultado>('/sync/yavendio/import/orders', {
      method: 'POST',
      body: JSON.stringify({ dryRun, ...(connectionId ? { connectionId } : {}) }),
    }),

  /** Cuentas de marketplaces conectadas del usuario */
  getConnections: () =>
    apiRequest<MarketplaceConnection[]>('/sync/connections', { method: 'GET' }),

  /** Conecta Yavendió con la API key que el usuario pega. La clave viaja
   *  al backend y nunca vuelve: solo se responde el nombre de la empresa. */
  connectYavendio: (apiKey: string, label?: string) =>
    apiRequest<{ marketplace: string; nickname: string }>('/sync/yavendio/connect', {
      method: 'POST',
      body: JSON.stringify({ apiKey, ...(label?.trim() ? { label: label.trim() } : {}) }),
    }),

  /** Conecta Falabella con el UserID (correo) y la API key del Seller Center. */
  connectFalabella: (userId: string, apiKey: string, label?: string) =>
    apiRequest<{ marketplace: string; nickname: string }>('/sync/falabella/connect', {
      method: 'POST',
      body: JSON.stringify({ userId, apiKey, ...(label?.trim() ? { label: label.trim() } : {}) }),
    }),

  /** Conecta una tienda WooCommerce con su dirección y la clave de la API REST. */
  connectWooCommerce: (siteUrl: string, consumerKey: string, consumerSecret: string, label?: string) =>
    apiRequest<{ marketplace: string; nickname: string }>('/sync/woocommerce/connect', {
      method: 'POST',
      body: JSON.stringify({ siteUrl, consumerKey, consumerSecret, ...(label?.trim() ? { label: label.trim() } : {}) }),
    }),

  /** Conecta una tienda Shopify con su dominio .myshopify.com y el token de la Admin API. */
  connectShopify: (shop: string, accessToken: string, label?: string) =>
    apiRequest<{ marketplace: string; nickname: string }>('/sync/shopify/connect', {
      method: 'POST',
      body: JSON.stringify({ shop, accessToken, ...(label?.trim() ? { label: label.trim() } : {}) }),
    }),

  /** Conecta Mercado Ripley (Mirakl) con la clave de API de la tienda; la dirección vacía es la de Perú. */
  connectRipley: (apiKey: string, site?: string, label?: string) =>
    apiRequest<{ marketplace: string; nickname: string }>('/sync/ripley/connect', {
      method: 'POST',
      body: JSON.stringify({ apiKey, ...(site?.trim() ? { site: site.trim() } : {}), ...(label?.trim() ? { label: label.trim() } : {}) }),
    }),

  /** Trae los productos que ya existen en WooCommerce, Shopify o Ripley. Con dryRun solo informa qué pasaría. */
  importChannelListings: (marketplace: 'woocommerce' | 'shopify' | 'ripley', dryRun: boolean, connectionId?: string, gruposManuales: GrupoManual[] = []) =>
    apiRequest<FalabellaImportSummary>(
      `/sync/channels/${marketplace}/listings/import?dryRun=${dryRun}${connectionId ? `&connectionId=${connectionId}` : ''}`,
      { method: 'POST', ...(gruposManuales.length ? { body: JSON.stringify({ gruposManuales }) } : {}) },
    ),

  /** Ripley: sugiere el color de cada oferta de las familias sin resolver, mirando sus fotos (solo sugiere; no escribe nada). */
  suggestRipleyColors: (familias: { parentSku: string; fichas: { sku: string; nombre: string; imagen: string | null }[] }[]) =>
    apiRequest<{ parentSku: string; colores: Record<string, string> }[]>('/sync/ripley/colores-ia', { method: 'POST', body: JSON.stringify({ familias }) }),

  /** Agrupa a mano productos ya importados como variantes: nombre, ejes y valor de cada SKU. */
  groupFalabellaVariants: (dto: { parentSku: string; name: string; axes: string[]; variants: { sellerSku: string; values: Record<string, string> }[] }) =>
    apiRequest<{ gruposCreados: number; gruposActualizados: number; variantesAgrupadas: number; omitidos: { parentSku: string; motivo: string }[] }>(
      '/sync/falabella/variants/group',
      { method: 'POST', body: JSON.stringify(dto) },
    ),

  /** Trae las publicaciones que ya existen en Falabella. Con dryRun solo informa qué pasaría. */
  importFalabellaListings: (dryRun: boolean, connectionId?: string, gruposManuales: GrupoManual[] = []) =>
    apiRequest<FalabellaImportSummary>(
      `/sync/falabella/listings/import?dryRun=${dryRun}${connectionId ? `&connectionId=${connectionId}` : ''}`,
      { method: 'POST', ...(gruposManuales.length ? { body: JSON.stringify({ gruposManuales }) } : {}) },
    ),

  /** Importa (o previsualiza) las publicaciones de una cuenta de Mercado Libre, enlazadas por SKU. */
  importMeliListings: (dryRun: boolean, connectionId?: string, generarSku = false) =>
    apiRequest<FalabellaImportSummary>(
      `/sync/mercadolibre/listings/import?dryRun=${dryRun}${connectionId ? `&connectionId=${connectionId}` : ""}${generarSku ? "&generarSku=true" : ""}`,
      { method: "POST" },
    ),

  /** Pausa o cierra publicaciones repetidas de Mercado Libre. Cerrar es definitivo; el servidor rechaza la principal de un SKU. */
  duplicatesAction: (action: "pause" | "close", externalIds: string[], connectionId?: string) =>
    apiRequest<{ results: { externalId: string; ok: boolean; message: string }[]; message: string }>(
      `/sync/mercadolibre/duplicates/${action}`,
      { method: "POST", body: JSON.stringify({ externalIds, ...(connectionId ? { connectionId } : {}) }) },
    ),

  /** Vuelve a leer ahora el estado de las publicaciones de la tienda. */
  refreshListings: () =>
    apiRequest<{ cuentas: { id: string; marketplace: string; nombre: string; revisadas: number; actualizadas: number; ausentes: number; error?: string }[] }>(
      "/sync/listings/refresh",
      { method: "POST" },
    ),

  /** Deja la constancia de las ventas de los últimos N días, sin tocar el stock. */
  importOrderHistory: (days: number, connectionId?: string) =>
    apiRequest<{
      dias: number;
      totalRegistradas: number;
      cuentas: { id: string; marketplace: string; nombre: string; registradas: number; yaRegistradas: number; incompleto: boolean; error?: string }[];
    }>(`/sync/orders/import-history?days=${days}${connectionId ? `&connectionId=${connectionId}` : ""}`, { method: "POST" }),

  /** Categorías de Falabella donde se puede publicar, filtradas por texto. */
  searchFalabellaCategories: (search: string) =>
    apiRequest<{ id: string; name: string; path: string }[]>(
      `/sync/falabella/categories?search=${encodeURIComponent(search)}`,
      { method: 'GET' },
    ),

  /** Marcas del catálogo de Falabella que coinciden con lo escrito. */
  searchFalabellaBrands: (search: string) =>
    apiRequest<string[]>(`/sync/falabella/brands?search=${encodeURIComponent(search)}`, { method: 'GET' }),

  /** Cambia la marca con la que se publica un producto en Falabella (solo del catálogo). */
  setFalabellaBrand: (productId: string, brand: string) =>
    apiRequest<{ brand: string }>(`/sync/falabella/products/${productId}/brand`, {
      method: 'PATCH',
      body: JSON.stringify({ brand }),
    }),

  /** Deja el producto listo para Falabella: categoría, marca, medidas y datos obligatorios. */
  autoPrepareFalabella: (productId: string) =>
    apiRequest<FalabellaPrepReport>(`/ai/products/${productId}/prepare-falabella`, { method: 'POST', body: JSON.stringify({}) }),

  /** Valores sugeridos para todos los atributos de una categoría de Falabella (no guarda nada). */
  suggestFalabellaAttributes: (productId: string, categoryId: string) =>
    apiRequest<{ values: Record<string, string>; estimated: string[]; filled: number; total: number }>(
      `/ai/products/${productId}/suggest-falabella-attributes`,
      { method: 'POST', body: JSON.stringify({ categoryId }) },
    ),

  /** Lanza el producto: deja listos los canales (categoría, marca, medidas, atributos, descripción HTML) y lo publica. */
  launchProduct: (productId: string, marketplaces: string[], connectionIds?: Record<string, string[]>, meliCategoryId?: string, soloPreparar?: boolean) =>
    apiRequest<LaunchReport>(`/ai/products/${productId}/launch`, {
      method: 'POST',
      body: JSON.stringify({
        marketplaces,
        ...(connectionIds && Object.keys(connectionIds).length ? { connectionIds } : {}),
        ...(meliCategoryId ? { meliCategoryId } : {}),
        ...(soloPreparar ? { soloPreparar: true } : {}),
      }),
    }),

  /** La ficha del producto: lo que se envía a cada canal donde está publicado. */
  getProductSheet: (productId: string) =>
    apiRequest<SheetData>(`/sync/products/${productId}/sheet`, { method: 'GET' }),

  /** Guarda cambios de la ficha; se envían solos a los canales donde está publicado. */
  saveProductSheet: (productId: string, cambios: Record<string, any>) =>
    apiRequest<{ saved: boolean; willUpdate: string[]; pricesSent?: string[] }>(`/sync/products/${productId}/sheet`, {
      method: 'PATCH',
      body: JSON.stringify(cambios),
    }),

  /** Guarda lo COMÚN de un grupo de variantes en todas a la vez (título, descripciones, HTML, marca, medidas, atributos de los canales) */
  saveGroupSheet: (groupId: string, cambios: Record<string, any>) =>
    apiRequest<{ saved: boolean; variantes: number; willUpdate: string[] }>(`/sync/groups/${groupId}/sheet`, {
      method: 'PATCH',
      body: JSON.stringify(cambios),
    }),

  /** Envía ya el contenido actual a cada canal publicado. */
  syncProductSheetNow: (productId: string) =>
    apiRequest<{ results: { marketplace: string; ok: boolean; message: string }[] }>(`/sync/products/${productId}/sheet/sync`, { method: 'POST' }),

  /**
   * Ficha ya publicada en Falabella, en dos pasos: sin `enviar` la IA solo prepara y guarda en Synkro (no se envía nada
   * al canal); con `enviar` se manda a Falabella lo que el producto tiene ahora, sin pasar por la IA.
   */
  updateFalabellaContent: (productId: string, opciones: { regenerar?: boolean; enviar?: boolean } = {}) =>
    apiRequest<{ message: string; sent: boolean; report?: FalabellaPrepReport }>(`/ai/products/${productId}/update-falabella`, {
      method: 'POST',
      body: JSON.stringify({ regenerar: opciones.regenerar ?? false, enviar: opciones.enviar ?? false }),
    }),

  /** Datos obligatorios que hay que pedirle a la persona para esa categoría. */
  getFalabellaCategoryFields: (categoryId: string) =>
    apiRequest<FalabellaField[]>(`/sync/falabella/categories/${categoryId}/fields`, { method: 'GET' }),

  /** Guarda categoría, medidas y atributos de un producto para Falabella. */
  prepareFalabella: (productId: string, payload: FalabellaPreparation) =>
    apiRequest<{ message: string; listo: boolean; motivo?: string }>(
      `/sync/falabella/products/${productId}/preparation`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    ),

  /** URL de autorización OAuth de Mercado Libre */
  getMeliAuthUrl: (label?: string) =>
    apiRequest<{ authUrl: string }>(`/sync/mercadolibre/auth-url${label?.trim() ? `?label=${encodeURIComponent(label.trim())}` : ''}`, { method: 'GET' }),

  /** Desconecta una cuenta de marketplace */
  disconnect: (connectionId: string) =>
    apiRequest<{ message: string }>(`/sync/connections/${connectionId}`, {
      method: 'DELETE',
    }),

  /** Publica un producto en los marketplaces indicados (asíncrono) */
  publish: (productId: string, marketplaces: string[], connectionIds?: Record<string, string>) =>
    apiRequest<{ message: string }>(`/sync/products/${productId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ marketplaces, ...(connectionIds ? { connectionIds } : {}) }),
    }),

  /** El canal quedó con otro stock que Synkro: vuelve a mandar a ESA cuenta el de Synkro (con el modo revisión, queda como solicitud) */
  resendListingStock: (listingId: string) =>
    apiRequest<{ message: string; pending?: number }>(`/sync/listings/${listingId}/resend-stock`, { method: 'POST' }),

  /** Lo mismo para varias publicaciones a la vez (hasta 200): cuántas se enviaron, cuántas quedaron en revisión y cuáles se omitieron */
  resendListingsStock: (listingIds: string[], campo: 'stock' | 'price' = 'stock') =>
    apiRequest<{ enviados: number; enRevision: number; omitidos: { listingId: string; motivo: string }[] }>('/sync/listings/resend-stock', {
      method: 'POST',
      body: JSON.stringify({ listingIds, campo }),
    }),

  /** Descuento de UNA cuenta de Falabella o Ripley (sin precio, lo quita). Falabella sale al instante; Ripley, con revisión, queda como solicitud */
  setListingPromo: (listingId: string, dto: { salePrice: number | null; saleStart?: string | null; saleEnd?: string | null }) =>
    apiRequest<{ message: string; pending?: number }>(`/sync/listings/${listingId}/promo`, { method: 'POST', body: JSON.stringify(dto) }),

  /** Ripley: vuelve a mandar a ESA oferta el precio normal de Synkro (solo el precio; con el modo revisión, queda como solicitud) */
  resendListingPrice: (listingId: string) =>
    apiRequest<{ message: string; pending?: number }>(`/sync/listings/${listingId}/resend-price`, { method: 'POST' }),

  /** Actualiza stock/precio local y lo sincroniza con los canales publicados */
  updateInventory: (productId: string, dto: UpdateInventoryDto) =>
    apiRequest<{ message: string; pending?: number }>(`/sync/products/${productId}/inventory`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  /** Pausa, reanuda o quita un producto de uno o de todos sus canales (sin linkIds actúa sobre todos). */
  channelAction: (productId: string, action: ChannelActionType, opts: { linkIds?: string[]; confirm?: boolean } = {}) =>
    apiRequest<ChannelActionResult>(`/sync/products/${productId}/channels/${action}`, {
      method: 'POST',
      body: JSON.stringify(opts),
    }),

  /** Estado de sincronización de un producto en cada marketplace */
  getProductStatus: (productId: string) =>
    apiRequest<ProductSyncStatus>(`/sync/products/${productId}/status`, {
      method: 'GET',
    }),

  /** Precio con descuento y fechas para Falabella; salePrice null lo quita de Synkro. No pasa por revisión. */
  setPromo: (productId: string, dto: { salePrice: number | null; saleStartDate?: string | null; saleEndDate?: string | null }) =>
    apiRequest<{ message: string }>(`/sync/products/${productId}/promo`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  /** Precio con descuento de la tienda web; null lo quita. No pasa por revisión. */
  setWebPrice: (productId: string, webPrice: number | null) =>
    apiRequest<{ message: string }>(`/sync/products/${productId}/web-price`, {
      method: 'PATCH',
      body: JSON.stringify({ webPrice }),
    }),

  /** Solicitudes de cambio de precio/stock (modo revisión) */
  getChangeRequests: (status?: ChangeRequestStatus) =>
    apiRequest<ChangeRequest[]>(`/sync/change-requests${status ? `?status=${status}` : ''}`, { method: 'GET' }),

  approveChange: (id: string) =>
    apiRequest<{ message: string }>(`/sync/change-requests/${id}/approve`, { method: 'POST' }),

  rejectChange: (id: string, reason?: string) =>
    apiRequest<{ id: string }>(`/sync/change-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getSyncSettings: () =>
    apiRequest<{ reviewMode: boolean }>('/sync/settings', { method: 'GET' }),

  setReviewMode: (enabled: boolean) =>
    apiRequest<{ reviewMode: boolean }>('/sync/settings/review-mode', {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  /** Ventas de la tienda activa, con cliente, envío, precio pagado y stock */
  getSales: (q: SalesQuery = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params.set(k, String(v));
    const qs = params.toString();
    return apiRequest<{ total: number; limit: number; offset: number; porEstado?: Partial<Record<SaleState, number>>; items: Sale[] }>(`/sync/orders${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  /** Registra a mano una venta de un canal no conectado. Cada fila lleva las columnas de la plantilla (varias filas con el mismo numero_pedido = una venta). */
  registerManualSale: (filas: Record<string, string | number>[]) =>
    apiRequest<ManualSalesResult>('/sync/orders/manual', { method: 'POST', body: JSON.stringify({ filas }) }),

  /** Registra ventas de canales no conectados desde un Excel con la plantilla */
  importManualSales: (file: File) => {
    const form = new FormData();
    form.append('excel', file);
    return apiRequestMultipart<ManualSalesResult>('/sync/orders/manual/import', form);
  },

  /** Edita una venta manual: devuelve el stock anterior y descuenta el nuevo */
  updateManualSale: (id: string, filas: Record<string, string | number>[]) =>
    apiRequest<ManualSalesResult>(`/sync/orders/manual/${id}`, { method: 'PUT', body: JSON.stringify({ filas }) }),

  /** Elimina una venta manual y devuelve al stock lo que descontó */
  /** Confirma que el producto de una venta cancelada o devuelta ya volvió al almacén: repone su stock */
  restockSale: (id: string) =>
    apiRequest<{ repuestas: number }>(`/sync/orders/${id}/restock`, { method: 'POST' }),

  deleteManualSale: (id: string) =>
    apiRequest<{ eliminada: boolean }>(`/sync/orders/manual/${id}`, { method: 'DELETE' }),

  /** Busca productos del catálogo por SKU o nombre para elegir el de una venta manual */
  searchManualSaleProducts: (search: string) =>
    apiRequest<ManualSaleProduct[]>(`/sync/orders/manual/products?search=${encodeURIComponent(search)}`, { method: 'GET' }),

  /** Descarga en Excel las ventas que coinciden con los filtros (una fila por producto vendido) */
  downloadSales: (q: SalesQuery = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '' && k !== 'limit' && k !== 'offset') params.set(k, String(v));
    const qs = params.toString();
    return apiDownload(`/sync/orders/export${qs ? `?${qs}` : ''}`, `ventas-${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  downloadManualSalesTemplate: () => apiDownload('/sync/orders/manual/template', 'plantilla-ventas.xlsx'),

  getSale: (id: string) => apiRequest<Sale>(`/sync/orders/${id}`, { method: 'GET' }),

  /** Trae ahora las ventas recientes de todas las cuentas de la tienda activa */
  syncOrders: () =>
    apiRequest<{
      cuentas: { id: string; marketplace: string; nombre: string; nuevos: number; revisados: number; error?: string }[];
      totalNuevos: number;
    }>('/sync/orders/sync', { method: 'POST' }),

  /** Todas las publicaciones del usuario en los marketplaces */
  getListings: () =>
    apiRequest<UserListing[]>('/sync/listings', { method: 'GET' }),
};
