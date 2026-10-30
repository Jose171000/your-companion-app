import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { crmApi, LEAD_STAGES, YavendioContactsResult, YavendioImportResult } from "@/lib/crm-api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, MessageCircle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const stageLabel = (id: string) =>
  LEAD_STAGES.find((s) => s.id === id)?.label ?? id;
const stageColor = (id: string) =>
  LEAD_STAGES.find((s) => s.id === id)?.color ?? "";

/**
 * Importa las conversaciones de Yavendió al embudo.
 *
 * Siempre se muestra primero una simulación: traer cientos de conversaciones
 * a ciegas es difícil de deshacer, así que el usuario ve exactamente cuántas
 * entran y en qué etapa antes de confirmar.
 */
export function ImportYavendioDialog({ open, onClose }: Props) {
  const [skipEmpty, setSkipEmpty] = useState(true);
  const [preview, setPreview] = useState<YavendioImportResult | null>(null);
  const [includeContacts, setIncludeContacts] = useState(true);
  const [contactsPreview, setContactsPreview] = useState<YavendioContactsResult | null>(null);
  const queryClient = useQueryClient();

  const simulate = useMutation({
    mutationFn: async (skip: boolean) => ({
      conversations: await crmApi.importYavendio(true, skip),
      // Los contactos son un extra: si fallan, las conversaciones siguen.
      contacts: await crmApi.importYavendioContacts(true).catch(() => null),
    }),
    onSuccess: ({ conversations: res, contacts }) => {
      if (res.error) {
        toast.error(res.error);
        setPreview(null);
        return;
      }
      setPreview(res.data ?? null);
      setContactsPreview(contacts?.data ?? null);
    },
    onError: () => toast.error("Error al consultar Yavendió"),
  });

  const confirm = useMutation({
    mutationFn: async () => ({
      conversations: await crmApi.importYavendio(false, skipEmpty),
      contacts: includeContacts ? await crmApi.importYavendioContacts(false).catch(() => null) : null,
    }),
    onSuccess: ({ conversations: res, contacts }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const r = res.data!;
      toast.success(
        `Importación terminada: ${r.created} nuevos y ${r.updated} actualizados` +
          (contacts?.data ? `, más ${contacts.data.created} contactos nuevos.` : ".")
      );
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      queryClient.invalidateQueries({ queryKey: ["crm-summary"] });
      onClose();
    },
    onError: () => toast.error("Error al importar desde Yavendió"),
  });

  // Al abrir, y cada vez que cambia el filtro, se recalcula la simulación.
  useEffect(() => {
    if (open) simulate.mutate(skipEmpty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, skipEmpty]);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setContactsPreview(null);
    }
  }, [open]);

  const entran = preview ? preview.total - preview.skipped : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Importar desde Yavendió
          </DialogTitle>
          <DialogDescription>
            Cada conversación de WhatsApp se convierte en un prospecto. Las ventas que
            Yavendió marca como cerradas entran como ganado o perdido; el resto según
            si ya hubo conversación.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="skip-empty" className="text-sm">
              Omitir contactos sin conversación
            </Label>
            <p className="text-xs text-muted-foreground">
              Deja fuera a quienes nunca intercambiaron un mensaje contigo.
            </p>
          </div>
          <Switch id="skip-empty" checked={skipEmpty} onCheckedChange={setSkipEmpty} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="space-y-0.5 pr-4">
            <Label htmlFor="include-contacts" className="text-sm">
              Incluir los contactos de Yavendió
            </Label>
            <p className="text-xs text-muted-foreground">
              {contactsPreview
                ? `${contactsPreview.created} nuevos como prospecto; ${contactsPreview.existing} ya están en tu CRM y no se tocan.`
                : "Quienes no hayan escrito aún también entran como prospectos nuevos."}
            </p>
          </div>
          <Switch id="include-contacts" checked={includeContacts} onCheckedChange={setIncludeContacts} />
        </div>

        {simulate.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : preview ? (
          <div className="space-y-3">
            <p className="text-sm">
              Entrarán <span className="font-semibold">{entran}</span> de{" "}
              {preview.total} conversaciones
              {preview.skipped > 0 && (
                <span className="text-muted-foreground"> ({preview.skipped} omitidas)</span>
              )}
              .
            </p>

            <div className="flex flex-wrap gap-2">
              {Object.entries(preview.byStage).map(([stage, count]) => (
                <Badge key={stage} variant="outline" className={stageColor(stage)}>
                  {stageLabel(stage)}: {count}
                </Badge>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {preview.created} nuevos · {preview.updated} ya existían y se actualizan.
              Los prospectos que hayas movido de etapa a mano no se tocan.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No se pudo obtener la vista previa. Revisa que tengas la cuenta de Yavendió
            conectada en Marketplaces.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={confirm.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => confirm.mutate()}
            disabled={!preview || entran === 0 || confirm.isPending || simulate.isPending}
          >
            {confirm.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
            {confirm.isPending ? "Importando…" : `Importar ${entran}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
