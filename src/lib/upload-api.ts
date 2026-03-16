import { apiRequest, apiRequestMultipart } from './api';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface UploadedImage {
  url: string;
  publicId?: string;
}

// ─────────────────────────────────────────────
// Upload API
// ─────────────────────────────────────────────

export const uploadApi = {
  /**
   * Sube una imagen a Cloudinary.
   * Formatos: JPEG, PNG, WebP, GIF — máx. 10 MB.
   * Se convierte automáticamente a JPG.
   */
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiRequestMultipart<UploadedImage>('/upload/image', form);
  },

  /**
   * Sube hasta 10 imágenes a Cloudinary en un solo request.
   * Se convierten automáticamente a WebP.
   */
  uploadImages: (files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    return apiRequestMultipart<UploadedImage[]>('/upload/images', form);
  },
};
