import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { activityApi } from "@/lib/activity-api";
import { ActivityTracker as Rastreador } from "@/lib/activity-tracker";
import { PRIVACY_TITLE } from "@/lib/privacy-notice";
import { PrivacyNoticeText } from "./PrivacyNotice";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Arranca el registro de actividad de la persona que inició sesión.
 *
 * Si todavía no aceptó el aviso de privacidad vigente, muestra la ventana del aviso y NO se registra nada hasta que acepte
 * (quien no quiera aceptar puede cerrar sesión). Se monta una sola vez, dentro del panel.
 */
export function ActivityTracker({ section }: { section: string }) {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const seccion = useRef(section);
  const [aceptando, setAceptando] = useState(false);
  seccion.current = section;

  const consentimiento = useQuery({
    queryKey: ["activity-consent", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const res = await activityApi.getConsent();
      if (res.error || !res.data) throw new Error(res.error ?? "No se pudo consultar el aviso de privacidad");
      return res.data;
    },
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const acepto = consentimiento.data?.accepted === true;

  useEffect(() => {
    if (!user || !acepto) return;
    const rastreador = new Rastreador(
      () => seccion.current,
      // El servidor dice que falta aceptar (por ejemplo, el aviso cambió de versión): se vuelve a preguntar.
      () => queryClient.invalidateQueries({ queryKey: ["activity-consent", user.id] }),
    );
    rastreador.start();
    return () => rastreador.stop();
  }, [user?.id, acepto, queryClient]);

  const aceptar = async () => {
    setAceptando(true);
    const res = await activityApi.acceptConsent();
    setAceptando(false);
    if (res.error) { toast.error(res.error); return; }
    await queryClient.invalidateQueries({ queryKey: ["activity-consent", user?.id] });
  };

  const hayQueMostrar = !!user && consentimiento.isSuccess && !acepto;

  return (
    <AlertDialog open={hayQueMostrar}>
      <AlertDialogContent
        className="max-w-lg"
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <div className="w-10 h-10 rounded-xl bg-[#FCCB34]/15 flex items-center justify-center mb-1">
            <ShieldCheck className="w-5 h-5 text-[#FCCB34]" />
          </div>
          <AlertDialogTitle>{PRIVACY_TITLE}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div><PrivacyNoticeText /></div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={() => void logout()} disabled={aceptando}>Cerrar sesión</Button>
          <Button type="button" onClick={aceptar} disabled={aceptando}>
            {aceptando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Aceptar y continuar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
