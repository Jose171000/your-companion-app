import { apiRequest } from './api';

/** Filtros comunes de todas las consultas de Superadmin › Actividad (solo superadmin; el servidor lo vuelve a exigir). */
export interface FiltroDeActividad {
  from: string;
  to: string;
  /** Vacío = todas las personas. */
  userId: string;
  platformRoles: string[];
  storeRoles: string[];
  /** Con todas las personas: promedio por persona o suma de todas. */
  mode: 'average' | 'total';
}

export interface OpcionesDeActividad {
  rolesPlataforma: string[];
  rolesTienda: string[];
  usuarios: { id: string; nombre: string; correo: string | null; rol: string }[];
}

export interface TotalesDeActividad {
  sesiones: number;
  segundosActivos: number;
  vistas: number;
  clics: number;
  acciones: number;
  ingresos: number;
}

export interface PuestoDeRanking {
  nombre: string;
  total: number;
  usuarios: number;
  /** 0-100 */
  porcentaje: number;
}

export interface CeldaDeHorario {
  /** 1 = lunes … 7 = domingo */
  dia: number;
  hora: number;
  eventos: number;
  segundos: number;
  valor: number;
}

export interface EventoDeLinea {
  at: string;
  tipo: string;
  pantalla: string;
  elemento: string | null;
  accion: string | null;
}

export interface ResumenDeActividad {
  filtro: { desde: string; hasta: string; promedio: boolean };
  resumen: {
    usuarios: number;
    promedio: boolean;
    total: TotalesDeActividad;
    porUsuario: TotalesDeActividad;
    ultimoIngreso: string | null;
  };
  secciones: PuestoDeRanking[];
  funciones: PuestoDeRanking[];
  horas: CeldaDeHorario[];
  linea: EventoDeLinea[] | null;
}

export interface PersonaDeActividad {
  userId: string;
  nombre: string;
  correo: string | null;
  rolPlataforma: string | null;
  rolTienda: string | null;
  sesiones: number;
  segundosActivos: number;
  acciones: number;
  clics: number;
  ultimoIngreso: string | null;
}

export interface PantallaConMapa {
  pantalla: string;
  clics: number;
  usuarios: number;
  vistas: number;
}

export interface ElementoDeMapa {
  elemento: string;
  clics: number;
  usuarios: number;
  /** 0-100 */
  participacion: number;
  /** 0-1, respecto al elemento más tocado */
  intensidad: number;
  /** Posición en milésimas de la pantalla; null si los clics fueron en ventanas emergentes. */
  rect: { x: number; y: number; w: number | null; h: number | null } | null;
}

function consulta(f: FiltroDeActividad, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ from: f.from, to: f.to, mode: f.mode, ...extra });
  if (f.userId) p.set('userId', f.userId);
  if (f.platformRoles.length) p.set('platformRoles', f.platformRoles.join(','));
  if (f.storeRoles.length) p.set('storeRoles', f.storeRoles.join(','));
  return p.toString();
}

export const activityAdminApi = {
  options: () => apiRequest<OpcionesDeActividad>('/admin/activity/options', { method: 'GET' }),
  overview: (f: FiltroDeActividad) => apiRequest<ResumenDeActividad>(`/admin/activity/overview?${consulta(f)}`, { method: 'GET' }),
  people: (f: FiltroDeActividad) => apiRequest<PersonaDeActividad[]>(`/admin/activity/people?${consulta(f)}`, { method: 'GET' }),
  screens: (f: FiltroDeActividad) => apiRequest<PantallaConMapa[]>(`/admin/activity/screens?${consulta(f)}`, { method: 'GET' }),
  clicks: (f: FiltroDeActividad, screen: string) =>
    apiRequest<ElementoDeMapa[]>(`/admin/activity/clicks?${consulta(f, { screen })}`, { method: 'GET' }),
};
