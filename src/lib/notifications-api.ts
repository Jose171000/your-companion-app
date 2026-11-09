import { apiRequest } from './api';

export type NotificationType =
  | 'sale'
  | 'publish'
  | 'publish-error'
  | 'connection'
  | 'low-stock'
  | 'import'
  | 'reconciliation'
  | 'system';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  marketplace?: string;
  /** La tienda a la que corresponde el aviso (nulo en avisos de la plataforma). */
  store?: { id: string; name: string } | null;
  meta?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface NotificationList {
  items: AppNotification[];
  unread: number;
}

export const notificationsApi = {
  list: (limit = 30) =>
    apiRequest<NotificationList>(`/notifications?limit=${limit}`, { method: 'GET' }),

  markRead: (id: string) =>
    apiRequest<{ message: string }>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () =>
    apiRequest<{ message: string }>('/notifications/read-all', { method: 'POST' }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/notifications/${id}`, { method: 'DELETE' }),
};

/** "hace 5 min", "hace 2 h", "hace 3 d" — más legible que una fecha completa. */
export function tiempoRelativo(iso: string): string {
  const segundos = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (segundos < 60) return 'hace un momento';
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} d`;
  return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}
