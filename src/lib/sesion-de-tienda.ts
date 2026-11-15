/**
 * La tienda activa se guarda en el navegador (`active_store_id`) y viaja en cada petición. Si quien inicia sesión no es
 * quien la guardó, esa tienda no es suya: al entrar con otra cuenta (o al cerrar sesión) hay que olvidarla.
 * Sin esto, un superadmin sin tienda propia veía los productos de la tienda de la cuenta anterior.
 */
const TIENDA_ACTIVA = 'active_store_id';
const DUENO_DE_LA_TIENDA_ACTIVA = 'active_store_owner';

const leer = (clave: string): string | null => {
  try { return localStorage.getItem(clave); } catch { return null; }
};
const quitar = (clave: string) => {
  try { localStorage.removeItem(clave); } catch { /* sin almacenamiento */ }
};

/**
 * Se llama al entrar con una cuenta. Si la tienda guardada era de otra persona, se olvida.
 * Devuelve `true` si hubo cambio de persona (hay que vaciar también lo que quedó en memoria).
 * Una tienda guardada sin dueño anotado (sesiones anteriores a este cambio) se conserva y se anota a nombre de quien entra:
 * si no fuera suya, el servidor la rechaza y se usa la primera de su lista.
 */
export function prepararTiendaActivaDe(usuarioId: string): boolean {
  const anterior = leer(DUENO_DE_LA_TIENDA_ACTIVA);
  const cambioDePersona = anterior !== null && anterior !== usuarioId;
  if (cambioDePersona) quitar(TIENDA_ACTIVA);
  try { localStorage.setItem(DUENO_DE_LA_TIENDA_ACTIVA, usuarioId); } catch { /* sin almacenamiento */ }
  return cambioDePersona;
}
