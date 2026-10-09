import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Mail, RefreshCw, Trash2 } from "lucide-react";
import { ROLE_LABELS, storesApi, StoreSummary } from "@/lib/stores-api";
import { useStores } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  store: StoreSummary | null;
  onClose: () => void;
}

type InviteRole = "editor" | "viewer";

const ROLE_HELP: Record<InviteRole, string> = {
  editor: "Puede proponer cambios; el dueño los aprueba.",
  viewer: "Solo puede ver.",
};

export function ManageStoreDialog({ store, onClose }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { refresh } = useStores();
  const isOwner = store?.role === "owner";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("viewer");
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  const id = store?.id ?? "";
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["store-members", id] });
    queryClient.invalidateQueries({ queryKey: ["store-invitations", id] });
    refresh();
  };

  const membersQuery = useQuery({
    queryKey: ["store-members", id],
    queryFn: () => storesApi.members(id),
    enabled: !!store,
  });
  const invitationsQuery = useQuery({
    queryKey: ["store-invitations", id],
    queryFn: () => storesApi.invitations(id),
    enabled: !!store && isOwner,
  });

  const inviteMutation = useMutation({
    mutationFn: () => storesApi.invite(id, email.trim(), role),
    onSuccess: (res) => {
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudo enviar la invitación");
        return;
      }
      toast.success(
        res.data.emailSent
          ? `Invitación enviada a ${res.data.email}`
          : `Invitación creada, pero el correo no salió. Vuelve a invitar a ${res.data.email}.`,
      );
      setEmail("");
      invalidate();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const roleMutation = useMutation({
    mutationFn: (v: { userId: string; role: InviteRole }) => storesApi.changeRole(id, v.userId, v.role),
    onSuccess: (res) => (res.error ? toast.error(res.error) : invalidate()),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => storesApi.removeMember(id, userId),
    onSuccess: (res) => {
      if (res.error) toast.error(res.error);
      else { toast.success("Acceso quitado"); invalidate(); }
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => storesApi.revokeInvitation(id, invitationId),
    onSuccess: (res) => (res.error ? toast.error(res.error) : invalidate()),
  });

  const linkMutation = useMutation({
    mutationFn: (v: { enabled: boolean; regenerate?: boolean }) => storesApi.setPublicLink(id, v.enabled, v.regenerate),
    onSuccess: (res) => {
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudo cambiar el enlace");
        return;
      }
      // El servidor solo aporta el código: el dominio se toma de este mismo sitio,
      // para que el enlace apunte siempre a donde el usuario está viendo la app.
      const code = res.data.url?.split("/t/")[1];
      setPublicUrl(res.data.publicEnabled && code ? `${window.location.origin}/t/${code}` : null);
      invalidate();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar; selecciónalo y cópialo a mano");
    }
  };

  const members = membersQuery.data?.data ?? [];
  const pending = invitationsQuery.data?.data ?? [];
  const accessError = membersQuery.data?.error;
  const currentPublicUrl = publicUrl;

  return (
    <Dialog open={store !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{store?.name}</DialogTitle>
          <DialogDescription>
            Tu rol: <span className="font-medium">{store ? ROLE_LABELS[store.role] : ""}</span>
          </DialogDescription>
        </DialogHeader>

        {accessError ? (
          <p className="text-sm text-destructive py-6 text-center">{accessError}</p>
        ) : (
          <Tabs defaultValue="miembros">
            <TabsList>
              <TabsTrigger value="miembros">Equipo</TabsTrigger>
              {isOwner && <TabsTrigger value="invitar">Invitar</TabsTrigger>}
              {isOwner && <TabsTrigger value="enlace">Enlace público</TabsTrigger>}
            </TabsList>

            <TabsContent value="miembros" className="pt-4 space-y-2">
              {membersQuery.isLoading && <Skeleton className="h-12 w-full" />}
              {members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.name || m.email} {m.userId === user?.id && <span className="text-muted-foreground">(tú)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                  {isOwner && m.role !== "owner" ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Select value={m.role} onValueChange={(v) => roleMutation.mutate({ userId: m.userId, role: v as InviteRole })}>
                        <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Lector</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline" size="icon" className="h-8 w-8" aria-label="Quitar acceso"
                        onClick={() => removeMutation.mutate(m.userId)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">{ROLE_LABELS[m.role]}</Badge>
                  )}
                </div>
              ))}
            </TabsContent>

            {isOwner && (
              <TabsContent value="invitar" className="pt-4 space-y-5">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="inv-email">Correo de la persona</Label>
                    <Input id="inv-email" type="email" placeholder="persona@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Lector</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{ROLE_HELP[role]}</p>
                  </div>
                  <Button
                    className="gradient-primary gap-1.5"
                    disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || inviteMutation.isPending}
                    onClick={() => inviteMutation.mutate()}
                  >
                    <Mail className="w-4 h-4" /> Enviar invitación
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    La invitación caduca en 7 días y solo la puede aceptar ese correo.
                  </p>
                </div>

                {pending.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Pendientes</p>
                    {pending.map((i) => (
                      <div key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                        <div className="min-w-0">
                          <p className="text-sm truncate">{i.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {ROLE_LABELS[i.role]} · {i.expired ? "caducó" : `vence ${new Date(i.expiresAt).toLocaleDateString()}`}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => revokeMutation.mutate(i.id)}>Anular</Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}

            {isOwner && (
              <TabsContent value="enlace" className="pt-4 space-y-4">
                <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-2"><Link2 className="w-4 h-4" /> Información general pública</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cualquiera con el enlace ve el nombre de la tienda, los canales, cuántas publicaciones tiene y su estado.
                      No muestra precios, stock, ventas ni pedidos.
                    </p>
                  </div>
                  <Switch
                    checked={store?.publicEnabled ?? false}
                    disabled={linkMutation.isPending}
                    onCheckedChange={(enabled) => linkMutation.mutate({ enabled })}
                    aria-label="Enlace público"
                  />
                </div>

                {store?.publicEnabled && (
                  <div className="space-y-2">
                    {currentPublicUrl ? (
                      <div className="flex gap-2">
                        <Input readOnly value={currentPublicUrl} onFocus={(e) => e.currentTarget.select()} />
                        <Button variant="outline" size="icon" aria-label="Copiar" onClick={() => copy(currentPublicUrl)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Para ver el enlace pulsa «Regenerar enlace»: se crea uno nuevo y el anterior deja de funcionar.
                      </p>
                    )}
                    <Button
                      variant="outline" size="sm" className="gap-1.5"
                      disabled={linkMutation.isPending}
                      onClick={() => linkMutation.mutate({ enabled: true, regenerate: true })}
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Regenerar enlace
                    </Button>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
