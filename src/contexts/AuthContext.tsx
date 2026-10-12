import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, User, AuthResponse, LoginCredentials, RegisterCredentials, ForgotPasswordCredentials, ResetPasswordCredentials } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  register: (credentials: RegisterCredentials) => Promise<{ success: boolean; error?: string; pending?: boolean; message?: string }>;
  logout: () => Promise<void>;
  forgotPassword: (credentials: ForgotPasswordCredentials) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (credentials: ResetPasswordCredentials) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: { name?: string; lastName?: string }) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      authApi.getProfile().then(({ data, error }) => {
        if (data && !error) {
          setUser(data);
        } else {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const { data, error } = await authApi.login(credentials);

    if (error || !data) {
      return { success: false, error: error || 'Error al iniciar sesión' };
    }

    localStorage.setItem('auth_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    setUser(data.user);
    return { success: true };
  };

  const register = async (credentials: RegisterCredentials) => {
    const { data, error } = await authApi.register(credentials);

    if (error || !data) {
      return { success: false, error: error || 'Error al registrarse' };
    }

    // Una cuenta nueva espera la aprobación de un superadmin: no entra, se le explica qué sigue.
    if ('pending' in data && data.pending) {
      return { success: true, pending: true, message: data.message };
    }

    const sesion = data as AuthResponse;
    localStorage.setItem('auth_token', sesion.accessToken);
    localStorage.setItem('refresh_token', sesion.refreshToken);
    setUser(sesion.user);
    return { success: true };
  };

  const logout = async () => {
    await authApi.logout().catch(() => null); // best-effort, ignora errores de red
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  const forgotPassword = async (credentials: ForgotPasswordCredentials) => {
    const { error } = await authApi.forgotPassword(credentials);
    if (error) return { success: false, error };
    return { success: true };
  };

  const resetPassword = async (credentials: ResetPasswordCredentials) => {
    const { error } = await authApi.resetPassword(credentials);
    if (error) return { success: false, error };
    return { success: true };
  };

  const updateProfile = async (data: { name?: string; lastName?: string }) => {
    const { data: updated, error } = await authApi.updateProfile(data);
    if (error || !updated) return { success: false, error: error || 'Error al actualizar perfil' };
    setUser(updated); // update local state immediately
    return { success: true };
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
