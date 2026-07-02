// API Configuration
// In development, use localhost. In production, this will be your deployed backend URL.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_PREFIX = '/api/v1';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
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

    const response = await fetch(`${API_BASE_URL}${API_PREFIX}${endpoint}`, {
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

    const response = await fetch(`${API_BASE_URL}${API_PREFIX}${endpoint}`, {
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

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}${endpoint}`, {
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
    apiRequest<AuthResponse>('/auth/register', {
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
