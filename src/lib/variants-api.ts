import { apiRequest, apiRequestMultipart } from './api';

export interface EjeDeVariacion {
  name: string;
  values: string[];
}

/** Lo que la IA concluye al revisar las fotos y el texto: ¿el producto se vende en varias versiones? */
export interface DeteccionDeVariantes {
  nivel: 'alta' | 'media' | 'baja' | 'ninguna';
  recomendar: boolean;
  ejes: { name: string; values: string[]; evidence: string }[];
  /** Qué valor muestra cada foto (índice desde 1), o null si la foto no es de un valor concreto. */
  fotos: { indice: number; valores: Record<string, string> | null }[];
  resumen: string;
}

export interface VarianteEntrada {
  values: Record<string, string>;
  sku?: string | null;
  price?: number | null;
  stock?: number | null;
  images?: string[];
}

export interface CrearGrupoPayload {
  parentSku?: string;
  name?: string;
  description?: string;
  targetMarketplaces?: string[];
  generateWithAi?: boolean;
  axes: EjeDeVariacion[];
  variants: VarianteEntrada[];
}

export interface VistaDeGrupo {
  ia?: { ok: boolean; motivo?: string };
  id: string;
  name: string;
  parentSku: string;
  axes: EjeDeVariacion[];
  variants: {
    id: string;
    sku: string;
    name: string;
    price: number | null;
    stock: number;
    variantValues: Record<string, string> | null;
    images: string[];
  }[];
}

/** Reduce una foto para el detector: se manda sin guardarla, así que no hace falta el tamaño original. */
export async function reducirParaDetector(file: File, maximo = 1280): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maximo / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

export const variantsApi = {
  /** El SKU que se asignaría ahora en la tienda activa (sigue el formato de la tienda). Solo informa: no lo reserva. */
  nextSku: () => apiRequest<{ skus: string[] }>('/products/sku/next?count=1', { method: 'GET' }),

  /** Filtro previo: las fotos y el texto se mandan para revisarlos, no se guardan. */
  detect: async (files: File[], text: string) => {
    const form = new FormData();
    (await Promise.all(files.slice(0, 8).map((f) => reducirParaDetector(f)))).forEach((f) => form.append('images', f));
    if (text.trim()) form.append('text', text.trim());
    return apiRequestMultipart<{ resultado: DeteccionDeVariantes | null }>('/products/variants/detect', form);
  },

  /** Crea el producto con todas sus variantes (y, si se pide, genera el contenido con IA una sola vez). */
  createGroup: (payload: CrearGrupoPayload) =>
    apiRequest<VistaDeGrupo>('/products/groups', { method: 'POST', body: JSON.stringify(payload) }),

  /** Agrega variantes a un producto ya creado (si es simple, lo convierte en grupo). */
  addVariants: (
    productId: string,
    payload: { axes?: EjeDeVariacion[]; thisVariant?: Record<string, string>; variants: VarianteEntrada[] },
  ) => apiRequest<VistaDeGrupo>(`/products/${productId}/variants`, { method: 'POST', body: JSON.stringify(payload) }),

  getGroup: (id: string) => apiRequest<VistaDeGrupo>(`/products/groups/${id}`, { method: 'GET' }),
};
