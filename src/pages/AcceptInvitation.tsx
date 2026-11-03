import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PENDING_INVITATION_KEY, useStores } from "@/contexts/StoreContext";
import { useQuery } from "@tanstack/react-query";
import { ROLE_LABELS, StoreRole, storesApi } from "@/lib/stores-api";
import { Button } from "@/components/ui/button";

/**
 * Destino del enlace del correo de invitación. Si ya hay sesión se acepta al
 * momento; si no, el código se guarda y se acepta justo después de entrar o de
 * crear la cuenta (StoreProvider lo recoge).
 */
export default function AcceptInvitation() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { isAuthenticated, isLoading } = useAuth();
  const { setActiveStore, refresh } = useStores();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  // Sin sesión se muestra a qué tienda lo invitan antes de pedirle nada.
  const info = useQuery({
    queryKey: ["invitation-info", token],
    queryFn: () => storesApi.invitationInfo(token),
    enabled: !!token && !isLoading && !isAuthenticated,
    retry: false,
  });
  const invitacion = info.data?.data;

  useEffect(() => {
    if (isLoading || started.current) return;

    if (!token) {
      setError("El enlace de invitación está incompleto.");
      return;
    }

    if (!isAuthenticated) {
      try { localStorage.setItem(PENDING_INVITATION_KEY, token); } catch { /* sin almacenamiento */ }
      return;
    }

    started.current = true;
    storesApi.acceptInvitation(token).then((res) => {
      if (res.error || !res.data) {
        setError(res.error ?? "No se pudo aceptar la invitación.");
        return;
      }
      toast.success(`Ahora tienes acceso a ${res.data.name}`);
      setActiveStore(res.data.storeId);
      refresh();
      navigate("/", { replace: true });
    });
  }, [isLoading, isAuthenticated, token, navigate, refresh, setActiveStore]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full text-center space-y-4">
        <MailCheck className="w-10 h-10 mx-auto text-primary" />
        <h1 className="text-xl font-bold">Invitación a una tienda</h1>

        {error ? (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <Button asChild variant="outline"><Link to="/">Ir a mi cuenta</Link></Button>
          </>
        ) : isLoading || isAuthenticated ? (
          <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          info.isLoading ? (
            <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : !invitacion ? (
            <>
              <p className="text-sm text-destructive">{info.data?.error ?? "La invitación no es válida o ya caducó. Pide una nueva al dueño de la tienda."}</p>
              <Button asChild variant="outline"><Link to="/login">Iniciar sesión</Link></Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {invitacion.inviterName ?? "El dueño de la tienda"} te invitó a <strong className="text-foreground">{invitacion.storeName}</strong> como{" "}
                <strong className="text-foreground">{invitacion.roleName ?? ROLE_LABELS[invitacion.role as StoreRole] ?? invitacion.role}</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                Usa el correo <strong className="text-foreground">{invitacion.email}</strong>. Si aún no tienes cuenta, crearla toma un minuto y no necesitas registrar una empresa.
              </p>
              <div className="flex gap-2 justify-center">
                <Button asChild className="gradient-primary"><Link to={`/invitacion/registro?token=${encodeURIComponent(token)}`}>Crear mi acceso</Link></Button>
                <Button asChild variant="outline"><Link to="/login">Ya tengo cuenta</Link></Button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
