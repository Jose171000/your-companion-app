/**
 * Permisos de una tienda (los mismos del servidor: docs/roles-de-tienda.md en el repo del servidor). El servidor es quien manda
 * —comprueba cada petición—; la app solo los usa para mostrar u ocultar botones y explicar por qué algo no está disponible.
 */
export const PERMISOS = [
  'productos.ver', 'canales.ver', 'ventas.ver', 'ventas.contacto', 'analiticas.ver', 'costos.ver',
  'productos.editar', 'productos.eliminar', 'productos.descargar', 'inventario.editar',
  'canales.publicar', 'canales.conectar', 'cambios.aprobar',
  'ventas.registrar', 'ventas.descargar',
] as const;

export type Permiso = (typeof PERMISOS)[number];

type Rol = 'owner' | 'editor' | 'viewer';

const LECTOR: Permiso[] = ['productos.ver', 'canales.ver', 'ventas.ver', 'analiticas.ver', 'costos.ver'];
const EDITOR: Permiso[] = [
  ...LECTOR, 'ventas.contacto', 'productos.editar', 'productos.eliminar', 'productos.descargar', 'inventario.editar',
  'canales.publicar', 'ventas.registrar', 'ventas.descargar',
];

/** Permisos de los roles de fábrica. Solo se usa si el servidor todavía no manda la lista (versión anterior). */
export const PERMISOS_DE_FABRICA: Record<Rol, readonly Permiso[]> = { viewer: LECTOR, editor: EDITOR, owner: PERMISOS };
