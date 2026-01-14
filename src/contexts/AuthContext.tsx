import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, User, LoginCredentials, RegisterCredentials } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  register: (credentials: RegisterCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('auth_token');
    if (token) {
      authApi.getProfile().then(({ data, error }) => {
        if (data && !error) {
          setUser(data);
        } else {
          // Token invalid, remove it
          localStorage.removeItem('auth_token');
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

    localStorage.setItem('auth_token', data.access_token);
    setUser(data.user);
    return { success: true };
  };

  const register = async (credentials: RegisterCredentials) => {
    const { data, error } = await authApi.register(credentials);
    
    if (error || !data) {
      return { success: false, error: error || 'Error al registrarse' };
    }

    localStorage.setItem('auth_token', data.access_token);
    setUser(data.user);
    return { success: true };
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
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
