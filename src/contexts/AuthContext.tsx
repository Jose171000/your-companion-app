import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, User, LoginCredentials, RegisterCredentials, ForgotPasswordCredentials, ResetPasswordCredentials } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  register: (credentials: RegisterCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  forgotPassword: (credentials: ForgotPasswordCredentials) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (credentials: ResetPasswordCredentials) => Promise<{ success: boolean; error?: string }>;
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

    localStorage.setItem('auth_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    setUser(data.user);
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
