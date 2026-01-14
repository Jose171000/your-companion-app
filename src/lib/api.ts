// API Configuration
// In development, use localhost. In production, this will be your deployed backend URL.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ApiResponse<T = unknown> {
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

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || 'Error en la solicitud' };
    }

    return { data };
  } catch (error) {
    console.error('API Error:', error);
    return { error: 'Error de conexión con el servidor' };
  }
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface User {
  id: string;
  email: string;
  name?: string;
}

// Auth API functions
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

  getProfile: () =>
    apiRequest<User>('/auth/profile', {
      method: 'GET',
    }),
};

export { apiRequest, API_BASE_URL };
