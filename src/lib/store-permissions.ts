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

// ── Edición de roles (pantalla «Roles») ──────────────────────────────────

/** Lo que el servidor manda en `GET /stores/permissions/catalog`. */
export interface PermisoDelCatalogo {
  clave: Permiso;
  titulo: string;
  ayuda: string;
  grupo: string;
  /** Pide una advertencia al darlo. */
  delicado?: boolean;
  /** Permisos que este necesita para tener sentido. */
  requiere: Permiso[];
}

export interface RolDeFabrica {
  clave: Rol;
  nombre: string;
  permisos: Permiso[];
}

type Requiere = Record<string, readonly Permiso[]>;

const mapaDeRequisitos = (catalogo: readonly PermisoDelCatalogo[]): Requiere =>
  Object.fromEntries(catalogo.map((p) => [p.clave, p.requiere]));

/** Marca un permiso y todo lo que necesita (también lo que esos necesitan). */
export function marcar(seleccion: ReadonlySet<Permiso>, permiso: Permiso, catalogo: readonly PermisoDelCatalogo[]): Set<Permiso> {
  const requiere = mapaDeRequisitos(catalogo);
  const resultado = new Set(seleccion);
  const agregar = (p: Permiso) => {
    if (resultado.has(p) && p !== permiso) return;
    resultado.add(p);
    (requiere[p] ?? []).forEach((r) => { if (!resultado.has(r)) agregar(r); });
  };
  agregar(permiso);
  return resultado;
}

/** Los permisos marcados que necesitan a este (directa o indirectamente). */
export function dependientesMarcados(seleccion: ReadonlySet<Permiso>, permiso: Permiso, catalogo: readonly PermisoDelCatalogo[]): Permiso[] {
  const requiere = mapaDeRequisitos(catalogo);
  const resultado = new Set<Permiso>();
  const buscar = (objetivo: Permiso) => {
    for (const p of seleccion) {
      if (!resultado.has(p) && (requiere[p] ?? []).includes(objetivo)) { resultado.add(p); buscar(p); }
    }
  };
  buscar(permiso);
  return [...resultado];
}

/** Quita un permiso y los que no pueden vivir sin él. Devuelve además cuáles se quitaron «de rebote». */
export function desmarcar(seleccion: ReadonlySet<Permiso>, permiso: Permiso, catalogo: readonly PermisoDelCatalogo[]): { resultado: Set<Permiso>; tambienQuitados: Permiso[] } {
  const tambienQuitados = dependientesMarcados(seleccion, permiso, catalogo);
  const resultado = new Set(seleccion);
  resultado.delete(permiso);
  tambienQuitados.forEach((p) => resultado.delete(p));
  return { resultado, tambienQuitados };
}

/**
 * ¿Este conjunto es exactamente el de un rol de fábrica? Decide si lo marcado se muestra con el nombre de ese rol o como
 * «Personalizado»: quitar o agregar un permiso a un rol de fábrica lo vuelve personalizado, y si el conjunto vuelve a coincidir,
 * vuelve a ser el de fábrica.
 */
export function rolDeFabricaIgualA(seleccion: ReadonlySet<Permiso>, fabrica: readonly RolDeFabrica[]): RolDeFabrica | null {
  return fabrica.find((f) => f.permisos.length === seleccion.size && f.permisos.every((p) => seleccion.has(p))) ?? null;
}
