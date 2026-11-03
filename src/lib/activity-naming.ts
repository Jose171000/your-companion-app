/**
 * Cómo se nombra cada clic para el registro de actividad, sin guardar nunca datos de personas.
 *
 * Es lógica pura (sin DOM) para poder probarla: el rastreador extrae un «descriptor» del elemento tocado y aquí se decide
 * su etiqueta. La regla de fondo: el nombre sale de un atributo `data-track` o del texto FIJO de un botón de la interfaz
 * (Descargar, Registrar ventas…), jamás del contenido de una fila, una tarjeta o un campo. El servidor repite la limpieza.
 */

export interface DescriptorDeElemento {
  tag: string;
  role: string | null;
  type: string | null;
  /** Valor de `data-track` del elemento o de un ancestro. */
  track: string | null;
  ariaLabel: string | null;
  placeholder: string | null;
  name: string | null;
  title: string | null;
  /** Texto visible del elemento. */
  texto: string;
  /** Está dentro de una fila de tabla o una lista de datos. */
  dentroDeFila: boolean;
  /** Está dentro de una zona marcada con `data-track-ignore`. */
  dentroDeIgnorado: boolean;
  /** Tiene bloques dentro (una tarjeta con varios textos), no solo un icono y un rótulo. */
  hijosComplejos: boolean;
}

/** Minúsculas, sin tildes, solo letras, números y «. _ :». Igual que en el servidor. */
export function aEtiqueta(valor: string | null | undefined, max = 80): string | null {
  const bruto = String(valor ?? '').trim();
  if (!bruto) return null;
  const etiqueta = bruto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._:]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
  return etiqueta || null;
}

/** Un texto que parece un dato personal (correo, número largo) no sirve de nombre. */
export function parecePersonal(texto: string): boolean {
  return texto.includes('@') || /\d{5,}/.test(texto.replace(/[\s.-]/g, ''));
}

const CAMPOS = ['input', 'textarea', 'select'];
const ROLES_CON_ROTULO = ['tab', 'menuitem', 'option', 'combobox', 'switch', 'checkbox', 'radio'];

/**
 * Etiqueta del clic, o null si no debe registrarse (zona ignorada o algo que no es un control: texto suelto, fondo).
 */
export function etiquetaDeClic(d: DescriptorDeElemento): string | null {
  if (d.dentroDeIgnorado) return null;
  if (d.track) return aEtiqueta(d.track) ?? 'otros';

  const tag = d.tag.toLowerCase();
  if (CAMPOS.includes(tag)) {
    // De un campo nunca se toma su valor: solo qué campo es. Una contraseña no se nombra ni por su rótulo.
    if (d.type === 'password') return 'campo-contrasena';
    return `campo-${aEtiqueta(d.ariaLabel ?? d.placeholder ?? d.name ?? d.type ?? tag, 60) ?? tag}`;
  }

  const esControl = ['button', 'a', 'summary', 'label'].includes(tag) || (d.role !== null && ROLES_CON_ROTULO.includes(d.role));
  if (tag === 'tr' || tag === 'td' || (!esControl && d.dentroDeFila)) return 'fila-de-tabla';
  if (!esControl) return null;

  // Un control dentro de una fila de datos se nombra por su rótulo accesible, no por el texto de la fila.
  if (d.dentroDeFila) return aEtiqueta(d.ariaLabel, 60) ?? 'control-en-fila';

  // Una tarjeta entera clicable trae textos de datos (cliente, producto): se registra solo como «tarjeta».
  if (d.hijosComplejos) return aEtiqueta(d.ariaLabel, 60) ?? 'tarjeta';

  // Un texto con varios números o con un año (un rango de fechas) cambia con los datos: no es un rótulo fijo. «30 días» sí.
  const bruto = d.texto.replace(/\s+/g, ' ').trim();
  const variable = (bruto.match(/\d+/g) ?? []).length >= 2 || /\b\d{4}\b/.test(bruto);
  // Un contador pegado al rótulo («Cancelados 2», «Clientes (12)») cambia con los datos: el rótulo es solo la palabra.
  const sinContador = bruto.replace(/\s+[(\[]?\d+[)\]]?$/, '');
  const texto = /[a-záéíóúñ]/i.test(sinContador) ? sinContador : bruto;
  if (texto && !variable && texto.length <= 40 && !parecePersonal(texto)) return aEtiqueta(texto, 60) ?? 'otros';
  const alternativo = d.ariaLabel ?? d.title;
  if (alternativo && alternativo.length <= 60 && !/\d{2,}/.test(alternativo) && !parecePersonal(alternativo)) return aEtiqueta(alternativo, 60) ?? 'otros';
  return texto ? 'boton' : 'icono';
}

/** Pantalla: la sección y, si hay una pestaña activa dentro, su nombre («marketplaces.ventas»). */
export function pantallaCompuesta(seccion: string, pestana: string | null): string {
  const base = aEtiqueta(seccion, 30) ?? 'otros';
  const sub = aEtiqueta(pestana, 28);
  return sub && !parecePersonal(pestana ?? '') ? `${base}.${sub}` : base;
}

/** Posición como milésimas (0-1000) dentro de una longitud de referencia; null si cae fuera. */
export function aMilesimas(valor: number, inicio: number, longitud: number): number | null {
  if (!(longitud > 0) || !Number.isFinite(valor)) return null;
  const f = (valor - inicio) / longitud;
  return f >= 0 && f <= 1 ? Math.round(f * 1000) : null;
}
