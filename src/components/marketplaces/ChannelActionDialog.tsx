import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChannelActionType, UserListing, syncApi } from "@/lib/sync-api";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { channelName } from "./format";

export interface PendingChannelAction {
  productId: string;
  productName: string;
  action: ChannelActionType;
  /** Publicación concreta (botón de un canal); sin ella actúa sobre todas las del producto (botón general). */
  listing?: UserListing;
  /** Publicaciones del producto, para listar lo que se va a tocar. */
  listings: UserListing[];
}

/** Lo que pasa en cada canal, dicho sin rodeos. */
function efecto(marketplace: string, action: ChannelActionType): string {
  if (marketplace === "mercadolibre") {
    return action === "pause" ? "se pausa la publicación" : action === "resume" ? "se reactiva la publicación" : "se cierra la publicación (no se puede reabrir)";
  }
  if (marketplace === "falabella") {
    return action === "pause" ? "queda con stock 0, sin poder venderse" : action === "resume" ? "vuelve a mostrar el stock real" : "se da de baja la ficha";
  }
  return "este canal todavía no se controla desde Synkro";
}

/** Estado que cuenta para decidir si una acción aplica: una ficha pausada con stock 0 puede figurar «publicada» en el canal. */
export const estadoVisible = (l: UserListing) => (l.pausedByUser && l.syncStatus === "published" ? "paused" : l.syncStatus);

const ADMITEN: Record<ChannelActionType, string[]> = { pause: ["published"], resume: ["paused"], remove: ["published", "paused", "error"] };

export function ChannelActionDialog({ pending, onClose }: { pending: PendingChannelAction | null; onClose: () => void }) {
  const queryClient = useQueryClient();

  const alcance = pending ? (pending.listing ? [pending.listing] : pending.listings).filter((l) => ADMITEN[pending.action].includes(estadoVisible(l))) : [];

  const mutation = useMutation({
    mutationFn: () =>
      syncApi.channelAction(pending!.productId, pending!.action, {
        linkIds: pending!.listing ? [pending!.listing.id] : alcance.map((l) => l.id),
        confirm: pending!.action === "remove" ? true : undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const fallos = res.data?.results.filter((r) => !r.ok) ?? [];
      if (fallos.length) toast.warning(res.data!.message, { duration: 15000 });
      else toast.success(res.data?.message ?? "Listo");
      onClose();
    },
    onError: () => toast.error("No se pudo completar la acción. Inténtalo de nuevo."),
  });

  const titulo = !pending ? "" : pending.action === "pause" ? "¿Pausar" : pending.action === "resume" ? "¿Reanudar" : "¿Quitar";
  const dondeTexto = pending?.listing ? `en ${channelName(pending.listing.marketplace)}` : "en todos sus canales";
  const peligrosa = pending?.action === "remove";

  return (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending && `${titulo} «${pending.productName}» ${pending.action === "remove" ? "de" : "en"} ${pending.listing ? channelName(pending.listing.marketplace) : "todos sus canales"}?`}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              {alcance.length ? (
                <ul className="space-y-1">
                  {alcance.map((l) => (
                    <li key={l.id}>
                      <span className="font-medium text-foreground">
                        {channelName(l.marketplace)}
                        {l.accountLabel ? ` · ${l.accountLabel}` : ""}
                      </span>
                      : {efecto(l.marketplace, pending!.action)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Ninguna publicación admite esta acción ahora mismo.</p>
              )}
              {pending?.action === "pause" && <p>Mientras esté pausado, Synkro no le envía stock ni precio. Se puede reanudar cuando quieras.</p>}
              {peligrosa && (
                <p className="font-medium text-red-400">
                  Quitarlo {dondeTexto} no se puede deshacer desde aquí. El producto sigue en Synkro y se puede volver a publicar.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
          <Button
            variant={peligrosa ? "destructive" : "default"}
            disabled={mutation.isPending || !alcance.length}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Procesando…" : pending?.action === "pause" ? "Pausar" : pending?.action === "resume" ? "Reanudar" : "Sí, quitar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
