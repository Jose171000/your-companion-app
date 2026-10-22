// API Configuration
// In development, use localhost. In production, this will be your deployed backend URL.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_PREFIX = '/api/v1';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

// ─────────────────────────────────────────────
// Sesión: el token de acceso dura poco, así que se renueva solo
// ─────────────────────────────────────────────

/** Rutas donde un 401 es una respuesta normal (contraseña incorrecta…), no un token vencido. */
const RUTAS_SIN_RENOVAR = /\/auth\/(login|register|refresh|forgot-password|reset-password)/;

export const EVENTO_SESION_VENCIDA = 'synkro:sesion-vencida';

type ResultadoDeRenovar = 'ok' | 'vencida' | 'temporal';
let renovando: Promise<ResultadoDeRenovar> | null = null;

async function pedirNuevosTokens(tokenUsado: string | null): Promise<ResultadoDeRenovar> {
  // Otra petición u otra pestaña ya renovó mientras esperábamos: basta con usar el token nuevo.
  const actual = localStorage.getItem('auth_token');
  if (actual && tokenUsado && actual !== tokenUsado) return 'ok';

  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return 'vencida';
  try {
    const r = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (r.status === 401 || r.status === 403) return 'vencida';
    if (!r.ok) return 'temporal';
    const json = await r.json();
    const datos = json.data ?? json;
    if (!datos?.accessToken || !datos?.refreshToken) return 'temporal';
    localStorage.setItem('auth_token', datos.accessToken);
    localStorage.setItem('refresh_token', datos.refreshToken);
    return 'ok';
  } catch {
    return 'temporal';
  }
}

/**
 * Renueva la sesión con el token de refresco. Una sola renovación a la vez: el token de refresco es de un solo uso, así
 * que dos renovaciones simultáneas (varias peticiones, o varias pestañas) cerrarían la sesión por error.
 */
function renovarSesion(tokenUsado: string | null): Promise<ResultadoDeRenovar> {
  if (renovando) return renovando;
  const bloqueos = (typeof navigator !== 'undefined' ? (navigator as any).locks : undefined) as
    | { request: (nombre: string, fn: () => Promise<ResultadoDeRenovar>) => Promise<ResultadoDeRenovar> }
    | undefined;
  renovando = (async () => (bloqueos ? bloqueos.request('synkro-renovar-sesion', () => pedirNuevosTokens(tokenUsado)) : pedirNuevosTokens(tokenUsado)))()
    .finally(() => { renovando = null; });
  return renovando;
}

/**
 * fetch con sesión: si el servidor responde 401 por token vencido, renueva la sesión y repite la petición una vez.
 * Solo si la renovación también falla (sesión realmente vencida) avisa a la aplicación para volver al inicio de sesión.
 */
async function fetchConSesion(url: string, init: RequestInit): Promise<Response> {
  const respuesta = await fetch(url, init);
  if (respuesta.status !== 401 || RUTAS_SIN_RENOVAR.test(url)) return respuesta;

  const cabeceras = (init.headers ?? {}) as Record<string, string>;
  const tokenUsado = (cabeceras['Authorization'] ?? '').replace(/^Bearer /, '') || null;
  const resultado = await renovarSesion(tokenUsado);
  if (resultado === 'vencida') {
    window.dispatchEvent(new Event(EVENTO_SESION_VENCIDA));
    return respuesta;
  }
  if (resultado === 'temporal') return respuesta;

  const nuevo = localStorage.getItem('auth_token');
  return fetch(url, { ...init, headers: { ...cabeceras, ...(nuevo ? { Authorization: `Bearer ${nuevo}` } : {}) } });
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = localStorage.getItem('auth_token');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    // Todo lo de canales ocurre dentro de la tienda activa. El servidor la
    // comprueba en cada petición: este encabezado solo dice cuál se está viendo.
    if (endpoint.startsWith('/sync/') || endpoint.startsWith('/reports/') || endpoint.startsWith('/dashboard/summary') || endpoint.startsWith('/bulk-upload/') || endpoint.startsWith('/ai/products/') || endpoint.startsWith('/products')) {
      try {
        const storeId = localStorage.getItem('active_store_id');
        if (storeId) (headers as Record<string, string>)['X-Store-Id'] = storeId;
      } catch { /* sin almacenamiento: el servidor usa la tienda por defecto */ }
    }

    const response = await fetchConSesion(`${API_BASE_URL}${API_PREFIX}${endpoint}`, {
      ...options,
      headers,
    });

    const json = await response.json();

    if (!response.ok) {
      const message =
        json.message ||
        json.error ||
        (json.data && json.data.message) ||
        'Error en la solicitud';
      const errorMessage =
        typeof message === 'string'
          ? message
          : Array.isArray(message)
            ? message[0]
            : 'Error en la solicitud';
      return { error: errorMessage };
    }

    return { data: json.data !== undefined ? json.data : json };
  } catch (error) {
    console.error('API Error:', error);
    return { error: 'Error de conexión con el servidor' };
  }
}

/**
 * apiRequestMultipart — para endpoints que reciben multipart/form-data (uploads).
 * No establece Content-Type manualmente; el browser lo define con el boundary correcto.
 */
async function apiRequestMultipart<T>(
  endpoint: string,
  body: FormData,
  method: 'POST' | 'PATCH' = 'POST'
): Promise<ApiResponse<T>> {
  try {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {};

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
    // La carga masiva publica en los canales de la tienda activa, y los productos nuevos nacen en ella.
    if (endpoint.startsWith('/bulk-upload/') || endpoint.startsWith('/products')) {
      try {
        const storeId = localStorage.getItem('active_store_id');
        if (storeId) (headers as Record<string, string>)['X-Store-Id'] = storeId;
      } catch { /* el servidor usa la tienda por defecto */ }
    }

    const response = await fetchConSesion(`${API_BASE_URL}${API_PREFIX}${endpoint}`, {
      method,
      headers,
      body,
    });

    const json = await response.json();

    if (!response.ok) {
      const message =
        json.message ||
        json.error ||
        (json.data && json.data.message) ||
        'Error en la solicitud';
      const errorMessage =
        typeof message === 'string'
          ? message
          : Array.isArray(message)
            ? message[0]
            : 'Error en la solicitud';
      return { error: errorMessage };
    }

    return { data: json.data !== undefined ? json.data : json };
  } catch (error) {
    console.error('API Error (multipart):', error);
    return { error: 'Error de conexión con el servidor' };
  }
}

// ─────────────────────────────────────────────
// File Download helper
// ─────────────────────────────────────────────

async function apiDownload(
  endpoint: string,
  filename: string,
  options: RequestInit = {}
): Promise<void> {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = { ...options.headers };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  // La plantilla de carga masiva depende de la tienda activa (sus canales conectados).
  if (endpoint.startsWith('/bulk-upload/')) {
    try {
      const storeId = localStorage.getItem('active_store_id');
      if (storeId) (headers as Record<string, string>)['X-Store-Id'] = storeId;
    } catch { /* sin almacenamiento: el servidor usa la tienda por defecto */ }
  }

  const response = await fetchConSesion(`${API_BASE_URL}${API_PREFIX}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = 'Error al descargar el archivo';
    try {
      const json = await response.json();
      if (json.message) errorMsg = typeof json.message === 'string' ? json.message : json.message[0];
      else if (json.error) errorMsg = json.error;
    } catch (e) {
      // Ignorar si no es JSON
    }
    throw new Error(errorMsg);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// Auth types
// ─────────────────────────────────────────────

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  lastName: string;
  /** Nombre de su tienda */
  nameCompany: string;
  /** Razón social */
  businessName: string;
  /** RUC (11 dígitos) */
  ruc: string;
  url?: string;
  cellPhone?: string;
}

/** Una cuenta nueva espera aprobación: no hay sesión, solo un aviso. */
export interface PendingRegisterResponse {
  user: User;
  pending: true;
  message: string;
}

export interface ForgotPasswordCredentials {
  email: string;
}

export interface ResetPasswordCredentials {
  token: string;
  newPassword: string;
}

export interface User {
  id: string;
  name: string;
  lastName: string;
  email: string;
  role: string;
  /** Secciones visibles. null o vacío = acceso completo. */
  allowedSections?: string[] | null;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MessageResponse {
  message: string;
}

// ─────────────────────────────────────────────
// Auth API functions
// ─────────────────────────────────────────────

export const authApi = {
  login: (credentials: LoginCredentials) =>
    apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  register: (credentials: RegisterCredentials) =>
    apiRequest<AuthResponse | PendingRegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  refreshTokens: (refreshToken: string) =>
    apiRequest<TokenResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logout: () =>
    apiRequest<MessageResponse>('/auth/logout', {
      method: 'POST',
    }),

  forgotPassword: (credentials: ForgotPasswordCredentials) =>
    apiRequest<MessageResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  resetPassword: (credentials: ResetPasswordCredentials) =>
    apiRequest<MessageResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  getProfile: () =>
    apiRequest<User>('/auth/profile', {
      method: 'GET',
    }),

  updateProfile: (data: { name?: string; lastName?: string }) =>
    apiRequest<User>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiRequest<{ message: string }>('/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

export { apiRequest, apiRequestMultipart, apiDownload, API_BASE_URL };
