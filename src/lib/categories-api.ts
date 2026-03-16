import { apiRequest } from './api';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface RequiredAttribute {
  name: string;
  description?: string;
  example?: string;
  isRequired?: boolean;
}

export interface Category {
  id: string;
  marketplace: string;
  categoryId: string;
  name: string;
  labelText: string;
  requiredAttributes?: RequiredAttribute[];
}

export interface AddCategoryDto {
  marketplace: string;
  categoryId: string;
  name: string;
  labelText: string;
  requiredAttributes?: RequiredAttribute[];
}

export type UpdateCategoryDto = Partial<Pick<AddCategoryDto, 'name' | 'labelText' | 'requiredAttributes'>>;

// ─────────────────────────────────────────────
// Categories API — [ADMIN]
// ─────────────────────────────────────────────

export const categoriesApi = {
  /** [ADMIN] Listar todas las categorías de marketplace */
  findAll: () =>
    apiRequest<Category[]>('/categories', { method: 'GET' }),

  /** [ADMIN] Agregar una nueva categoría (genera embedding semántico vía OpenAI) */
  create: (dto: AddCategoryDto) =>
    apiRequest<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  /** [ADMIN] Editar una categoría existente (regenera embedding si cambia labelText) */
  update: (id: string, dto: UpdateCategoryDto) =>
    apiRequest<Category>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  /** [ADMIN] Eliminar una categoría por ID */
  remove: (id: string) =>
    apiRequest<{ message: string }>(`/categories/${id}`, { method: 'DELETE' }),
};
