import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminApi,
  AdminClient,
  CreatePaymentDto,
  UpdateClientProfileDto,
} from "@/lib/admin-api";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, KeyRound, Loader2, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRestrictableSections } from "@/hooks/use-app-sections";
import { useAuth } from "@/contexts/AuthContext";

const ROLES: { id: "admin" | "contador" | "user"; label: string; ayuda: string }[] = [
  { id: "user", label: "Cliente", ayuda: "Ve solo sus tiendas. Es lo normal." },
  { id: "contador", label: "Contador", ayuda: "Solo finanzas y facturación." },
  { id: "admin", label: "Superadmin", ayuda: "Ve y gestiona a TODOS los clientes: finanzas, cuentas, tiendas y actividad. Puede eliminarlas." },
];

interface ClientDetailDialogProps {
  client: AdminClient | null;
  onClose: () => void;
}

const money = (n: number | string, currency = "PEN") =>
  `${currency === "USD" ? "$" : "S/"} ${Number(n || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const today = () => new Date().toISOString().slice(0, 10);

export function ClientDetailDialog({ client, onClose }: ClientDetailDialogProps) {
  const { secciones: RESTRICTABLE } = useRestrictableSections();
  const queryClient = useQueryClient();
  const { user: yo } = useAuth();
  const open = client !== null;
  const [rol, setRol] = useState<"admin" | "contador" | "user">("user");

  const [profile, setProfile] = useState<UpdateClientProfileDto>({});
  const [payment, setPayment] = useState<CreatePaymentDto>({
    amount: 0,
    type: "recurrente",
    frequency: "mensual",
    concept: "",
    method: "transferencia",
    paidAt: today(),
  });
  const [sections, setSections] = useState<string[]>([]);
  const [fullAccess, setFullAccess] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [embedCheck, setEmbedCheck] = useState<{ embeddable: boolean; reason: string | null } | null>(null);

  const { data: detailResult, isLoading } = useQuery({
    queryKey: ["admin-client", client?.id],
    queryFn: () => adminApi.getClient(client!.id),
    enabled: open,
  });

  const detail = detailResult?.data;

  // Carga el perfil existente al abrir
  useEffect(() => {
    if (!client) return;
    const p = detail?.profile ?? client.profile;
    setProfile({
      ruc: p?.ruc ?? "",
      businessName: p?.businessName ?? client.nameCompany ?? "",
      fiscalAddress: p?.fiscalAddress ?? "",
      clientType: p?.clientType ?? "saas",
      status: p?.status ?? "activo",
      contactName: p?.contactName ?? `${client.name} ${client.lastName}`.trim(),
      contactPhone: p?.contactPhone ?? client.cellPhone ?? "",
      sheetCsvUrl: p?.sheetCsvUrl ?? "",
      reportEmbedUrl: p?.reportEmbedUrl ?? "",
      reportEmbedTitle: p?.reportEmbedTitle ?? "",
      notes: p?.notes ?? "",
    });

    const current = detail?.allowedSections ?? client.allowedSections ?? [];
    setSections(current ?? []);
    setFullAccess(!current || current.length === 0);
    setIsActive(detail?.isActive ?? client.isActive ?? true);
    setRol((client.role as "admin" | "contador" | "user") ?? "user");
    setNewPassword(null);
    setEmbedCheck(null);
  }, [client, detail]);

  const saveProfile = useMutation({
    mutationFn: () => {
      // No enviar strings vacíos (el DTO valida URL y campos opcionales)
      const clean: UpdateClientProfileDto = {};
      Object.entries(profile).forEach(([k, v]) => {
        if (v !== "" && v !== undefined && v !== null) (clean as any)[k] = v;
      });
      return adminApi.updateProfile(client!.id, clean);
    },
    onSuccess: (res) => {
      if (res.error) return toast.error(res.error);
      toast.success("Perfil del cliente actualizado");
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin-client", client?.id] });
    },
    onError: () => toast.error("Error al guardar el perfil"),
  });

  const addPayment = useMutation({
    mutationFn: () => adminApi.addPayment(client!.id, payment),
    onSuccess: (res) => {
      if (res.error) return toast.error(res.error);
      toast.success("Pago registrado");
      setPayment({
        amount: 0,
        type: "recurrente",
        frequency: "mensual",
        concept: "",
        method: "transferencia",
        paidAt: today(),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-client", client?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin-finance"] });
    },
    onError: () => toast.error("Error al registrar el pago"),
  });

  const removePayment = useMutation({
    mutationFn: (paymentId: string) => adminApi.removePayment(paymentId),
    onSuccess: () => {
      toast.success("Pago eliminado");
      queryClient.invalidateQueries({ queryKey: ["admin-client", client?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin-finance"] });
    },
    onError: () => toast.error("Error al eliminar el pago"),
  });

  const saveAccess = useMutation({
    mutationFn: () =>
      adminApi.updateAccess(client!.id, {
        allowedSections: fullAccess ? [] : sections,
        isActive,
      }),
    onSuccess: (res) => {
      if (res.error) return toast.error(res.error);
      toast.success("Permisos actualizados");
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin-client", client?.id] });
    },
    onError: () => toast.error("Error al guardar los permisos"),
  });

  const saveRole = useMutation({
    mutationFn: () => adminApi.updateRole(client!.id, rol),
    onSuccess: (res) => {
      if (res.error) return toast.error(res.error);
      toast.success(res.data?.message ?? "Rol actualizado");
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin-client", client?.id] });
    },
    onError: () => toast.error("Error al cambiar el rol"),
  });

  const cambiarRol = () => {
    const destino = ROLES.find((r) => r.id === rol)!;
    const aviso = rol === "admin"
      ? `Vas a hacer SUPERADMIN a ${client?.email}. Podrá ver y eliminar los datos de todos los clientes.`
      : `Vas a cambiar a ${client?.email} a «${destino.label}». Se cerrarán sus sesiones abiertas.`;
    if (window.confirm(`${aviso}\n\n¿Continuar?`)) saveRole.mutate();
  };

  const checkEmbed = useMutation({
    mutationFn: () => adminApi.checkEmbeddable(profile.reportEmbedUrl!),
    onSuccess: (res) => {
      if (res.error) return toast.error(res.error);
      setEmbedCheck(res.data!);
    },
    onError: () => toast.error("No se pudo comprobar la URL"),
  });

  const resetPassword = useMutation({
    mutationFn: () => adminApi.resetPassword(client!.id),
    onSuccess: (res) => {
      if (res.error) return toast.error(res.error);
      setNewPassword(res.data!.password);
      toast.success("Contraseña restablecida");
    },
    onError: () => toast.error("Error al restablecer la contraseña"),
  });

  const toggleSection = (id: string) =>
    setSections((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const canAddPayment =
    payment.amount > 0 && payment.concept.trim().length > 0 && !addPayment.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client?.profile?.businessName || `${client?.name} ${client?.lastName}`}</DialogTitle>
          <DialogDescription>{client?.email}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="perfil">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            <TabsTrigger value="accesos">Accesos</TabsTrigger>
            <TabsTrigger value="pagos">Pagos</TabsTrigger>
          </TabsList>

          {/* ── PERFIL ─────────────────────────────────────────── */}
          <TabsContent value="perfil" className="space-y-4 pt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Razón social</Label>
                <Input
                  value={profile.businessName ?? ""}
                  onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
                  placeholder="Rivesi SAC"
                />
              </div>
              <div className="space-y-2">
                <Label>RUC</Label>
                <Input
                  value={profile.ruc ?? ""}
                  onChange={(e) => setProfile({ ...profile, ruc: e.target.value })}
                  placeholder="20601234567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dirección fiscal</Label>
              <Input
                value={profile.fiscalAddress ?? ""}
                onChange={(e) => setProfile({ ...profile, fiscalAddress: e.target.value })}
                placeholder="Av. Ejemplo 123, Lima"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de cliente</Label>
                <Select
                  value={profile.clientType ?? "saas"}
                  onValueChange={(v) => setProfile({ ...profile, clientType: v as "agency" | "saas" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agency">Agencia (retainer)</SelectItem>
                    <SelectItem value="saas">Software (licencia)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={profile.status ?? "activo"}
                  onValueChange={(v) => setProfile({ ...profile, status: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contacto</Label>
                <Input
                  value={profile.contactName ?? ""}
                  onChange={(e) => setProfile({ ...profile, contactName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={profile.contactPhone ?? ""}
                  onChange={(e) => setProfile({ ...profile, contactPhone: e.target.value })}
                  placeholder="+51 999 999 999"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Google Sheet de ventas (CSV publicado)</Label>
              <Input
                value={profile.sheetCsvUrl ?? ""}
                onChange={(e) => setProfile({ ...profile, sheetCsvUrl: e.target.value })}
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
              />
              <p className="text-xs text-muted-foreground">
                En el Sheet: Archivo → Compartir → Publicar en la web → CSV. El reporte del cliente sumará estos
                datos a las ventas de sus marketplaces.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Reporte externo embebido (AppScript, Looker Studio…)</Label>
              <div className="flex gap-2">
                <Input
                  value={profile.reportEmbedUrl ?? ""}
                  onChange={(e) => {
                    setProfile({ ...profile, reportEmbedUrl: e.target.value });
                    setEmbedCheck(null);
                  }}
                  placeholder="https://script.google.com/macros/s/.../exec"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => checkEmbed.mutate()}
                  disabled={!profile.reportEmbedUrl || checkEmbed.isPending}
                  title="Comprobar si se puede mostrar dentro de la app"
                >
                  {checkEmbed.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Probar"
                  )}
                </Button>
              </div>
              {embedCheck && (
                <p
                  className={cn(
                    "text-xs flex items-start gap-1.5",
                    embedCheck.embeddable ? "text-green-500" : "text-yellow-500"
                  )}
                >
                  {embedCheck.embeddable ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Se puede mostrar dentro de la app.
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {embedCheck.reason}
                    </>
                  )}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                El cliente verá este reporte dentro de sus Analíticas, junto al reporte de ventas
                de la plataforma.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Título de esa pestaña</Label>
              <Input
                value={profile.reportEmbedTitle ?? ""}
                onChange={(e) => setProfile({ ...profile, reportEmbedTitle: e.target.value })}
                placeholder="Reporte de ventas"
              />
            </div>

            <div className="space-y-2">
              <Label>Notas internas</Label>
              <Textarea
                rows={3}
                value={profile.notes ?? ""}
                onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
                placeholder="Acuerdos, condiciones especiales, historial…"
              />
            </div>

            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending} className="w-full sm:w-auto">
              {saveProfile.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar perfil
            </Button>
          </TabsContent>

          {/* ── ACCESOS ────────────────────────────────────────── */}
          <TabsContent value="accesos" className="space-y-5 pt-4">
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border">
              <div>
                <p className="font-medium text-sm">Cuenta activa</p>
                <p className="text-xs text-muted-foreground">
                  Al desactivarla, la persona conserva sus datos pero no podrá entrar.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#FCCB34]" />
                <p className="font-medium text-sm">Secciones visibles</p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={fullAccess ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFullAccess(true)}
                >
                  Acceso completo
                </Button>
                <Button
                  type="button"
                  variant={!fullAccess ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFullAccess(false)}
                >
                  Acceso limitado
                </Button>
              </div>

              {!fullAccess && (
                <div className="space-y-2 p-3 rounded-xl border border-border bg-secondary/20">
                  <p className="text-xs text-muted-foreground mb-2">
                    Dashboard y Configuración siempre están disponibles. Marca lo demás que quieras
                    habilitar para esta cuenta.
                  </p>
                  {RESTRICTABLE.map((section) => (
                    <label key={section.id} className="flex items-center gap-3 py-1.5 cursor-pointer">
                      <Checkbox
                        checked={sections.includes(section.id)}
                        onCheckedChange={() => toggleSection(section.id)}
                      />
                      <span className="text-sm">{section.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={() => saveAccess.mutate()}
              disabled={saveAccess.isPending}
              className="w-full sm:w-auto"
            >
              {saveAccess.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar permisos
            </Button>

            {/* Rol */}
            <div className="pt-5 border-t border-border space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#FCCB34]" />
                <p className="font-medium text-sm">Rol de la cuenta</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {ROLES.find((r) => r.id === rol)?.ayuda}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={rol} onValueChange={(v) => setRol(v as typeof rol)} disabled={client?.id === yo?.id}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={cambiarRol}
                  disabled={saveRole.isPending || rol === client?.role || client?.id === yo?.id}
                >
                  {saveRole.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Cambiar rol
                </Button>
              </div>
              {client?.id === yo?.id && (
                <p className="text-xs text-muted-foreground">No puedes cambiar tu propio rol.</p>
              )}
            </div>

            {/* Contraseña */}
            <div className="pt-5 border-t border-border space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#FCCB34]" />
                <p className="font-medium text-sm">Contraseña</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Úsalo si la persona perdió su acceso. Se generará una contraseña nueva que podrás
                copiar y enviarle; sus sesiones abiertas se cerrarán.
              </p>

              {newPassword ? (
                <div className="p-3 rounded-xl border border-green-500/30 bg-green-500/5 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Contraseña nueva — cópiala ahora, no volverá a mostrarse:
                  </p>
                  <div className="flex gap-2">
                    <code className="flex-1 px-3 py-2 rounded-lg bg-secondary font-mono text-sm select-all">
                      {newPassword}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard?.writeText(newPassword);
                        toast.success("Contraseña copiada");
                      }}
                      title="Copiar"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => resetPassword.mutate()}
                  disabled={resetPassword.isPending}
                  className="w-full sm:w-auto"
                >
                  {resetPassword.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4 mr-2" />
                  )}
                  Generar contraseña nueva
                </Button>
              )}
            </div>
          </TabsContent>

          {/* ── PAGOS ──────────────────────────────────────────── */}
          <TabsContent value="pagos" className="space-y-6 pt-4">
            {/* Nuevo pago */}
            <div className="glass rounded-2xl border border-border dark:border-white/10 p-4 space-y-4">
              <h4 className="font-semibold text-sm">Registrar pago</h4>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monto</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={payment.amount || ""}
                    onChange={(e) => setPayment({ ...payment, amount: Number(e.target.value) })}
                    placeholder="1500.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={payment.paidAt}
                    onChange={(e) => setPayment({ ...payment, paidAt: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={payment.type}
                    onValueChange={(v) =>
                      setPayment({
                        ...payment,
                        type: v as "unico" | "recurrente",
                        frequency: v === "recurrente" ? payment.frequency || "mensual" : undefined,
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recurrente">Recurrente</SelectItem>
                      <SelectItem value="unico">Pago único</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {payment.type === "recurrente" ? (
                  <div className="space-y-2">
                    <Label>Frecuencia</Label>
                    <Select
                      value={payment.frequency ?? "mensual"}
                      onValueChange={(v) => setPayment({ ...payment, frequency: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensual">Mensual</SelectItem>
                        <SelectItem value="trimestral">Trimestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Método</Label>
                    <Select
                      value={payment.method ?? "transferencia"}
                      onValueChange={(v) => setPayment({ ...payment, method: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                        <SelectItem value="yape">Yape</SelectItem>
                        <SelectItem value="plin">Plin</SelectItem>
                        <SelectItem value="tarjeta">Tarjeta</SelectItem>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Concepto</Label>
                <Input
                  value={payment.concept}
                  onChange={(e) => setPayment({ ...payment, concept: e.target.value })}
                  placeholder="Retainer agencia — julio 2026"
                />
              </div>

              <Button onClick={() => addPayment.mutate()} disabled={!canAddPayment} className="w-full sm:w-auto">
                {addPayment.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Registrar pago
              </Button>
            </div>

            {/* Historial */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Historial de pagos</h4>

              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : !detail?.payments?.length ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Este cliente aún no tiene pagos registrados.
                </p>
              ) : (
                <div className="space-y-2">
                  {detail.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border dark:border-white/10"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.concept}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.paidAt).toLocaleDateString("es-PE")}
                          {p.method ? ` · ${p.method}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-semibold text-sm tabular-nums">{money(p.amount, p.currency)}</p>
                          <Badge variant="secondary" className="text-[10px]">
                            {p.type === "recurrente" ? p.frequency ?? "recurrente" : "único"}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removePayment.mutate(p.id)}
                          title="Eliminar pago"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
