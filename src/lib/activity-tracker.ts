import { activityApi, EventoDeActividad } from './activity-api';
import { aEtiqueta, aMilesimas, DescriptorDeElemento, etiquetaDeClic, pantallaCompuesta } from './activity-naming';

/**
 * Rastreador de actividad propio (sin librerías ni servicios de terceros). Anota qué sección abre la persona, en qué
 * control hace clic (y dónde, dentro de la pantalla) y cuánto tiempo está activa. Se manda en lotes pequeños a nuestro
 * servidor. Solo corre cuando la persona aceptó el aviso de privacidad. Ver docs/actividad-de-usuarios.md (servidor).
 *
 * Qué NO hace: leer lo que se escribe en los campos, el contenido de filas o tarjetas, ni nada de las respuestas del servidor.
 */

const SESSION_KEY = 'synkro_activity_session';
const CONTROLES = 'button, a, [role=tab], [role=menuitem], [role=option], [role=combobox], [role=switch], [role=checkbox], [role=radio], input, textarea, select, summary, label, tr, td, [data-track]';
const CADA_ENVIO_MS = 10_000;
const CADA_LATIDO_S = 30;
const SIN_ACTIVIDAD_MS = 60_000;
const MAX_EN_COLA = 500;
const MAX_POR_LOTE = 100;

const uuid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); }));

function idDeSesion(): string {
  try {
    const guardado = sessionStorage.getItem(SESSION_KEY);
    if (guardado) return guardado;
    const nuevo = uuid();
    sessionStorage.setItem(SESSION_KEY, nuevo);
    return nuevo;
  } catch {
    return uuid();
  }
}

/** Zona de la pantalla sobre la que se miden las posiciones: el contenido, sin el menú lateral ni el encabezado. */
const zonaDeContenido = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-track-root]');

/** La sección visible del contenido (las demás están ocultas con display:none). */
function seccionVisible(raiz: HTMLElement | null): HTMLElement | null {
  if (!raiz) return null;
  return (Array.from(raiz.children) as HTMLElement[]).find((h) => h.style.display !== 'none' && h.offsetParent !== null) ?? null;
}

function descriptorDe(el: Element): DescriptorDeElemento {
  const html = el as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const complejos = Array.from(el.children).some((h) => {
    const t = h.tagName.toLowerCase();
    if (['svg', 'i', 'img'].includes(t)) return false;
    // Un rótulo simple (un span con solo texto o icono) no cuenta; un bloque con varios textos sí.
    return !(t === 'span' && Array.from(h.children).every((n) => ['svg', 'i'].includes(n.tagName.toLowerCase())));
  });
  return {
    tag,
    role: el.getAttribute('role'),
    type: el.getAttribute('type'),
    track: el.closest('[data-track]')?.getAttribute('data-track') ?? null,
    ariaLabel: el.getAttribute('aria-label'),
    placeholder: el.getAttribute('placeholder'),
    name: el.getAttribute('name'),
    title: el.getAttribute('title'),
    // Los campos no entregan su contenido: solo se mira texto en controles de la interfaz.
    texto: ['input', 'textarea', 'select'].includes(tag) ? '' : (html.innerText ?? html.textContent ?? '').slice(0, 80),
    dentroDeFila: !!el.closest('tr, [role=row], [data-row]'),
    dentroDeIgnorado: !!el.closest('[data-track-ignore]'),
    hijosComplejos: complejos,
  };
}

export class ActivityTracker {
  private cola: EventoDeActividad[] = [];
  private sessionId = idDeSesion();
  private seccion = 'otros';
  private pantalla = '';
  private ultimaActividad = Date.now();
  private ultimoLatido = Date.now();
  private temporizadores: number[] = [];
  private corriendo = false;
  private enviando = false;

  constructor(
    /** Devuelve el id de la sección visible (dashboard, products, marketplaces…). */
    private readonly obtenerSeccion: () => string,
    /** Se llama si el servidor dice que falta aceptar el aviso de privacidad. */
    private readonly alFaltarAviso: () => void,
  ) { }

  start() {
    if (this.corriendo) return;
    this.corriendo = true;
    this.ultimaActividad = this.ultimoLatido = Date.now();
    document.addEventListener('click', this.alHacerClic, true);
    for (const e of ['mousemove', 'keydown', 'scroll', 'touchstart']) window.addEventListener(e, this.alHaberActividad, { passive: true, capture: true });
    document.addEventListener('visibilitychange', this.alCambiarVisibilidad);
    window.addEventListener('pagehide', this.alSalir);
    this.temporizadores.push(
      window.setInterval(() => this.revisarPantalla(), 1000),
      window.setInterval(() => this.latir(), 5000),
      window.setInterval(() => void this.enviar(), CADA_ENVIO_MS),
    );
    this.revisarPantalla();
  }

  stop() {
    if (!this.corriendo) return;
    this.corriendo = false;
    document.removeEventListener('click', this.alHacerClic, true);
    for (const e of ['mousemove', 'keydown', 'scroll', 'touchstart']) window.removeEventListener(e, this.alHaberActividad, { capture: true } as EventListenerOptions);
    document.removeEventListener('visibilitychange', this.alCambiarVisibilidad);
    window.removeEventListener('pagehide', this.alSalir);
    this.temporizadores.forEach((t) => window.clearInterval(t));
    this.temporizadores = [];
    this.cola = [];
  }

  // ── Eventos del navegador ─────────────────────────────────────────────

  private alHaberActividad = () => { this.ultimaActividad = Date.now(); };

  private alCambiarVisibilidad = () => {
    if (document.visibilityState === 'hidden') void this.enviar();
    else this.ultimaActividad = Date.now();
  };

  private alSalir = () => { void this.enviar(); };

  private alHacerClic = (e: MouseEvent) => {
    try {
      this.ultimaActividad = Date.now();
      const objetivo = e.target as Element | null;
      const el = objetivo?.closest?.(CONTROLES);
      if (!el) return;
      const elemento = etiquetaDeClic(descriptorDe(el));
      if (!elemento) return;

      this.revisarPantalla();
      const raiz = zonaDeContenido();
      const caja = raiz?.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      // Las posiciones se miden dentro de la zona de contenido; el menú lateral y el encabezado quedan sin posición.
      const dentro = !!(raiz && caja && raiz.contains(el));
      const alto = raiz?.scrollHeight ?? 0;
      const arriba = (caja?.top ?? 0) + window.scrollY;
      const pos = dentro && caja ? {
        x: aMilesimas(e.clientX, caja.left, caja.width),
        y: aMilesimas(e.clientY + window.scrollY, arriba, alto),
        ex: aMilesimas(r.left, caja.left, caja.width),
        ey: aMilesimas(r.top + window.scrollY, arriba, alto),
        ew: aMilesimas(caja.left + r.width, caja.left, caja.width),
        eh: aMilesimas(arriba + r.height, arriba, alto),
      } : null;

      this.poner({
        t: 'click', screen: this.pantalla, element: elemento, at: Date.now(),
        ...(pos ? Object.fromEntries(Object.entries(pos).filter(([, v]) => v !== null)) : {}),
      });
    } catch { /* el rastreo nunca debe afectar a la aplicación */ }
  };

  // ── Pantallas y tiempo activo ─────────────────────────────────────────

  private revisarPantalla() {
    try {
      this.seccion = this.obtenerSeccion() || 'otros';
      const visible = seccionVisible(zonaDeContenido());
      const pestana = visible?.querySelector('[role=tab][data-state=active]')?.textContent ?? null;
      const actual = pantallaCompuesta(this.seccion, pestana);
      if (actual !== this.pantalla) {
        this.pantalla = actual;
        this.poner({ t: 'view', screen: actual, at: Date.now() });
      }
    } catch { /* ver arriba */ }
  }

  private latir() {
    const ahora = Date.now();
    if (ahora - this.ultimoLatido < CADA_LATIDO_S * 1000) return;
    const activo = document.visibilityState === 'visible' && ahora - this.ultimaActividad < SIN_ACTIVIDAD_MS;
    const segundos = Math.min(120, Math.round((ahora - this.ultimoLatido) / 1000));
    this.ultimoLatido = ahora;
    if (activo && this.pantalla) this.poner({ t: 'ping', screen: this.pantalla, v: segundos, at: ahora });
  }

  // ── Envío ─────────────────────────────────────────────────────────────

  private poner(evento: EventoDeActividad) {
    if (this.cola.length >= MAX_EN_COLA) this.cola.shift();
    this.cola.push(evento);
  }

  private async enviar() {
    if (this.enviando || !this.cola.length || !this.corriendo) return;
    this.enviando = true;
    const lote = this.cola.splice(0, MAX_POR_LOTE);
    try {
      let storeId: string | undefined;
      try { storeId = localStorage.getItem('active_store_id') ?? undefined; } catch { /* sin almacenamiento */ }
      const ancho = window.innerWidth;
      const res = await activityApi.sendEvents({
        sessionId: this.sessionId,
        ...(storeId ? { storeId } : {}),
        device: ancho < 768 ? 'movil' : ancho < 1024 ? 'tablet' : 'escritorio',
        events: lote,
      });
      if (res.data?.requiereAviso) {
        this.stop();
        this.alFaltarAviso();
      } else if (res.error) {
        // No se pudo enviar (sin red, sesión vencida): se devuelven a la cola para el próximo intento.
        this.cola.unshift(...lote);
        if (this.cola.length > MAX_EN_COLA) this.cola.splice(0, this.cola.length - MAX_EN_COLA);
      }
    } catch {
      this.cola.unshift(...lote);
    } finally {
      this.enviando = false;
    }
  }
}

export { aEtiqueta };
