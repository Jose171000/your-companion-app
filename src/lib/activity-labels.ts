/** Nombres legibles para lo que el rastreador registra con etiquetas técnicas (solo para mostrar en Superadmin › Actividad). */

const SECCIONES: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Productos',
  'ai-products': 'IA Productos',
  marketplaces: 'Marketplaces',
  analytics: 'Analíticas',
  crm: 'CRM',
  admin: 'Superadmin',
  settings: 'Configuración',
};

export const ROLES_DE_PLATAFORMA: Record<string, string> = {
  admin: 'Superadmin',
  contador: 'Contador',
  moderator: 'Moderador',
  user: 'Usuario',
};

export const ROLES_DE_TIENDA: Record<string, string> = {
  owner: 'Dueño',
  editor: 'Editor',
  viewer: 'Visor',
};

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const diaDeSemana = (iso: number) => DIAS[iso] ?? '';

const humanizar = (t: string) => {
  const limpio = t.replace(/[-_]+/g, ' ').trim();
  return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : t;
};

/** «marketplaces.ventas» → «Marketplaces › Ventas». */
export function nombreDePantalla(pantalla: string): string {
  const [base, ...resto] = pantalla.split('.');
  return [SECCIONES[base] ?? humanizar(base), ...resto.map(humanizar)].join(' › ');
}

/** «incluir-el-envio-en-las-ventas» → «Incluir el envio en las ventas». */
export const nombreDeElemento = humanizar;

/** 3725 → «1 h 02 min»; 90 → «1 min 30 s»; 40 → «40 s». */
export function duracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${s % 60 ? ` ${String(s % 60).padStart(2, '0')} s` : ''}`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

export const franjaHoraria = (h: number) => `${String(h).padStart(2, '0')}:00 – ${String((h + 1) % 24).padStart(2, '0')}:00`;
