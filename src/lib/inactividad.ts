/**
 * Sesión por actividad: mientras el usuario usa la aplicación la sesión se renueva sola; solo se cierra si pasa un rato
 * sin actividad. La última actividad se guarda para que también cuente al volver con otra pestaña o al reabrir la página.
 */
export const INACTIVIDAD_MINUTOS = Number(import.meta.env.VITE_INACTIVIDAD_MINUTOS) || 60;
const CLAVE = 'synkro_ultima_actividad';
/** No se escribe en el almacenamiento más de una vez cada tantos segundos: mover el mouse dispara miles de eventos. */
const ESCRIBIR_CADA_MS = 10_000;

let ultimaEscritura = 0;

export function registrarActividad(ahora = Date.now()): void {
  if (ahora - ultimaEscritura < ESCRIBIR_CADA_MS) return;
  ultimaEscritura = ahora;
  try { localStorage.setItem(CLAVE, String(ahora)); } catch { /* sin almacenamiento: la sesión no se cierra por esto */ }
}

/** Milisegundos desde la última actividad registrada; 0 si nunca se registró (sesión recién iniciada o de antes de este cambio). */
export function msSinActividad(ahora = Date.now()): number {
  try {
    const guardada = Number(localStorage.getItem(CLAVE));
    return Number.isFinite(guardada) && guardada > 0 ? Math.max(0, ahora - guardada) : 0;
  } catch {
    return 0;
  }
}

export const estaInactiva = (ahora = Date.now()): boolean => msSinActividad(ahora) > INACTIVIDAD_MINUTOS * 60_000;

export function olvidarActividad(): void {
  ultimaEscritura = 0;
  try { localStorage.removeItem(CLAVE); } catch { /* nada que limpiar */ }
}
