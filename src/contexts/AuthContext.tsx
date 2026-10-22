import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { EVENTO_SESION_VENCIDA } from '@/lib/api';
import { INACTIVIDAD_MINUTOS, estaInactiva, olvidarActividad, registrarActividad } from '@/lib/inactividad';
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

  // Sesión por actividad: se renueva sola mientras se usa la aplicación y solo se cierra tras un rato sin actividad.
  const limpiarSesion = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    olvidarActividad();
    setUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    // Si pasó más del tiempo de inactividad desde la última vez que se usó, la sesión ya se cerró (aunque el token siga vigente).
    if (token && estaInactiva()) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      olvidarActividad();
      toast.info(`Tu sesión se cerró por inactividad (${INACTIVIDAD_MINUTOS} min). Inicia sesión de nuevo.`);
      setIsLoading(false);
      return;
    }
    if (token) {
      authApi.getProfile().then(({ data, error }) => {
        if (data && !error) {
          setUser(data);
          registrarActividad();
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

  // Cada vez que el usuario interactúa se anota; si pasa el tiempo sin actividad se cierra la sesión (solo en este dispositivo).
  useEffect(() => {
    if (!user) return;
    const marcar = () => registrarActividad();
    const eventos = ['mousedown', 'mousemove', 'keydown', 'scroll', 'wheel', 'touchstart'] as const;
    eventos.forEach((e) => window.addEventListener(e, marcar, { passive: true }));

    const cerrarPorInactividad = () => {
      limpiarSesion();
      toast.info(`Tu sesión se cerró por inactividad (${INACTIVIDAD_MINUTOS} min). Inicia sesión de nuevo.`);
    };
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      if (estaInactiva()) cerrarPorInactividad();
      else registrarActividad();
    };
    document.addEventListener('visibilitychange', alVolver);
    const revisar = window.setInterval(() => { if (estaInactiva()) cerrarPorInactividad(); }, 30_000);
    registrarActividad();

    // El servidor ya no acepta ni el token ni su renovación (sesión realmente vencida).
    const alVencer = () => {
      limpiarSesion();
      toast.info('Tu sesión venció. Inicia sesión de nuevo.');
    };
    window.addEventListener(EVENTO_SESION_VENCIDA, alVencer);

    return () => {
      eventos.forEach((e) => window.removeEventListener(e, marcar));
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener(EVENTO_SESION_VENCIDA, alVencer);
      window.clearInterval(revisar);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (credentials: LoginCredentials) => {
    const { data, error } = await authApi.login(credentials);

    if (error || !data) {
      return { success: false, error: error || 'Error al iniciar sesión' };
    }

    localStorage.setItem('auth_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    registrarActividad();
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
    olvidarActividad();
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
