import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { storesApi, StoreSummary } from '@/lib/stores-api';

const ACTIVE_KEY = 'active_store_id';
/** Código de una invitación recibida antes de iniciar sesión; se acepta al entrar. */
export const PENDING_INVITATION_KEY = 'pending_invitation';

interface StoreContextType {
  stores: StoreSummary[];
  isLoading: boolean;
  activeStore: StoreSummary | null;
  /** Las cuentas que llegaron por invitación no pueden crear tiendas */
  canCreateStores: boolean;
  setActiveStore: (id: string) => void;
  refresh: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const read = (key: string) => {
  try { return localStorage.getItem(key); } catch { return null; }
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(() => read(ACTIVE_KEY));

  const { data, isLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: () => storesApi.list(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const stores = useMemo(() => data?.data?.stores ?? [], [data]);
  const canCreateStores = data?.data?.canCreateStores ?? false;

  // Si la tienda guardada ya no existe o perdió el acceso, se usa la primera.
  // El encabezado de las peticiones sale de aquí: se mantiene en sincronía con lo que se ve.
  const activeStore = useMemo(() => {
    const store = stores.find((s) => s.id === activeId) ?? stores[0] ?? null;
    // La tienda que se ve y la que viaja en las peticiones deben ser la misma:
    // se guarda aquí, antes de que ningún componente hijo pida datos.
    if (store) {
      try { if (localStorage.getItem(ACTIVE_KEY) !== store.id) localStorage.setItem(ACTIVE_KEY, store.id); } catch { /* nada */ }
    }
    return store;
  }, [stores, activeId]);

  const setActiveStore = useCallback((id: string) => {
    setActiveId(id);
    try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* sin almacenamiento: solo esta sesión */ }
    // Los canales, publicaciones y revisiones son de cada tienda: se descarta lo
    // de la anterior para no mostrarlo ni un instante bajo el nombre de la nueva.
    queryClient.removeQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('sync-') });
  }, [queryClient]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['stores'] });
  }, [queryClient]);

  // Invitación que llegó antes del login: se acepta ahora que hay sesión.
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = read(PENDING_INVITATION_KEY);
    if (!token) return;
    try { localStorage.removeItem(PENDING_INVITATION_KEY); } catch { /* nada */ }

    storesApi.acceptInvitation(token).then((res) => {
      if (res.error || !res.data) {
        toast.error(res.error ?? 'No se pudo aceptar la invitación');
        return;
      }
      toast.success(`Ahora tienes acceso a ${res.data.name}`);
      setActiveStore(res.data.storeId);
      refresh();
    });
  }, [isAuthenticated, refresh, setActiveStore]);

  const value = useMemo(
    () => ({ stores, isLoading, activeStore, canCreateStores, setActiveStore, refresh }),
    [stores, isLoading, activeStore, canCreateStores, setActiveStore, refresh],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStores() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStores debe usarse dentro de StoreProvider');
  return ctx;
}
