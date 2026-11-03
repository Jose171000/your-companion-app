import { apiRequest } from './api';

export interface EventoDeActividad {
  t: 'view' | 'click' | 'ping';
  screen: string;
  element?: string;
  /** Posición del clic y del elemento dentro de la pantalla, en milésimas (0-1000). */
  x?: number; y?: number; ex?: number; ey?: number; ew?: number; eh?: number;
  /** Segundos de actividad (solo «ping»). */
  v?: number;
  /** Cuándo ocurrió (milisegundos desde 1970). */
  at: number;
}

export interface LoteDeActividad {
  sessionId: string;
  storeId?: string;
  device: 'escritorio' | 'tablet' | 'movil';
  events: EventoDeActividad[];
}

export const activityApi = {
  /** Versión vigente del aviso de privacidad y si esta persona ya la aceptó. */
  getConsent: () => apiRequest<{ version: string; accepted: boolean }>('/activity/consent', { method: 'GET' }),

  /** Acepta el aviso de privacidad vigente. */
  acceptConsent: () => apiRequest<{ version: string; accepted: boolean }>('/activity/consent', { method: 'POST' }),

  /** Manda un lote de actividad. `keepalive` deja que termine de enviarse aunque se cierre la pestaña. */
  sendEvents: (lote: LoteDeActividad) =>
    apiRequest<{ registrados: number; descartados: number; requiereAviso: boolean }>('/activity/events', {
      method: 'POST',
      body: JSON.stringify(lote),
      keepalive: true,
    }),
};
