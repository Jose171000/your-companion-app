import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Mail, RefreshCw, Trash2 } from "lucide-react";
import { nombreDeRol, ROLE_LABELS, storesApi, StoreSummary } from "@/lib/stores-api";
import { asignacionDeValor, RolePicker, ValorDeRol, valorDeRol } from "./RolePicker";
import { RolesTab } from "./RolesTab";
import { useStores } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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

const ROLE_HELP: Record<string, string> = {
  "f:editor": "Crea y edita productos, publica en los canales, registra ventas y propone cambios de precio y stock.",
  "f:viewer": "Solo puede ver: no descarga archivos ni modifica nada.",
};

export function ManageStoreDialog({ store, onClose }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { refresh } = useStores();
  const isOwner = store?.role === "owner";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ValorDeRol>("f:viewer");
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  const id = store?.id ?? "";
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["store-members", id] });
    queryClient.invalidateQueries({ queryKey: ["store-invitations", id] });
    queryClient.invalidateQueries({ queryKey: ["store-roles", id] });
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

  // Los roles de la tienda (con los personalizados) para elegirlos al invitar o al cambiar el rol de alguien.
  const rolesQuery = useQuery({
    queryKey: ["store-roles", id],
    queryFn: () => storesApi.roles(id),
    enabled: !!store && isOwner,
  });
  const roles = rolesQuery.data?.data;

  /** Qué puede hacer quien tenga este rol, en una frase. */
  const ayudaDeRol = (valor: ValorDeRol): string => {
    if (ROLE_HELP[valor]) return ROLE_HELP[valor];
    const personalizado = roles?.personalizados.find((r) => `c:${r.id}` === valor);
    if (!personalizado) return "";
    const titulos = personalizado.permissions.map((p) => roles?.permisos.find((x) => x.clave === p)?.titulo ?? p);
    return `${personalizado.permissions.length} permisos: ${titulos.slice(0, 5).join(", ")}${titulos.length > 5 ? ` y ${titulos.length - 5} más` : ""}.`;
  };

  // Enlace de la última invitación: solo se conoce al crearla, así que se muestra aquí.
  const [lastInvite, setLastInvite] = useState<{ email: string; url: string } | null>(null);

  const inviteMutation = useMutation({
    mutationFn: () => storesApi.invite(id, email.trim(), asignacionDeValor(role)),
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
      setLastInvite({ email: res.data.email, url: res.data.acceptUrl });
      setEmail("");
      invalidate();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const roleMutation = useMutation({
    mutationFn: (v: { userId: string; valor: ValorDeRol }) => storesApi.changeRole(id, v.userId, asignacionDeValor(v.valor)),
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
            Tu rol: <span className="font-medium">{store ? (store.roleName ?? ROLE_LABELS[store.role]) : ""}</span>
          </DialogDescription>
        </DialogHeader>

        {accessError ? (
          <p className="text-sm text-destructive py-6 text-center">{accessError}</p>
        ) : (
          <Tabs defaultValue="miembros">
            <TabsList>
              <TabsTrigger value="miembros">Equipo</TabsTrigger>
              {isOwner && <TabsTrigger value="invitar">Invitar</TabsTrigger>}
              {isOwner && <TabsTrigger value="roles">Roles</TabsTrigger>}
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
                      <RolePicker
                        value={valorDeRol(m)}
                        roles={roles}
                        triggerClassName="h-8 w-36 text-xs"
                        onChange={(valor) => roleMutation.mutate({ userId: m.userId, valor })}
                      />
                      <Button
                        variant="outline" size="icon" className="h-8 w-8" aria-label="Quitar acceso"
                        onClick={() => removeMutation.mutate(m.userId)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">{nombreDeRol(m)}</Badge>
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
                    <RolePicker value={role} roles={roles} onChange={setRole} />
                    <p className="text-xs text-muted-foreground">{ayudaDeRol(role)}</p>
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
                  {lastInvite && (
                    <div className="rounded-xl bg-secondary/30 p-3 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Enlace para {lastInvite.email}. Puedes enviárselo por WhatsApp u otro medio; solo funciona con ese correo.
                      </p>
                      <div className="flex gap-2">
                        <Input readOnly value={lastInvite.url} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-1.5 shrink-0"
                          onClick={() => navigator.clipboard.writeText(lastInvite.url).then(() => toast.success("Enlace copiado"), () => toast.error("No se pudo copiar; selecciónalo y cópialo a mano"))}
                        >
                          <Copy className="w-4 h-4" /> Copiar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {pending.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Pendientes</p>
                    {pending.map((i) => (
                      <div key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                        <div className="min-w-0">
                          <p className="text-sm truncate">{i.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {nombreDeRol(i)} · {i.expired ? "caducó" : `vence ${new Date(i.expiresAt).toLocaleDateString()}`}
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
              <TabsContent value="roles" className="pt-4">
                <RolesTab storeId={id} />
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
