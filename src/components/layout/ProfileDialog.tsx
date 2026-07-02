import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="bg-secondary/50 border-border h-11 pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileDialog({ open, onClose }: ProfileDialogProps) {
  const { user, updateProfile } = useAuth();

  // ── Info tab state ─────────────────────────────────────────────────────────
  const [name, setName]           = useState(user?.name ?? "");
  const [lastName, setLastName]   = useState(user?.lastName ?? "");
  const [savingInfo, setSavingInfo] = useState(false);

  // ── Password tab state ─────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPwd, setSavingPwd]             = useState(false);

  // Sync local state when dialog opens or user changes
  useEffect(() => {
    if (open && user) {
      setName(user.name ?? "");
      setLastName(user.lastName ?? "");
    }
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [open, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const initials = user
    ? `${user.name?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "U"
    : "?";
  const displayName = user ? `${user.name ?? ""} ${user.lastName ?? ""}`.trim() : "";

  // Dirty check for info tab
  const infoIsDirty =
    (name || "").trim() !== (user?.name ?? "") ||
    (lastName || "").trim() !== (user?.lastName ?? "");

  // ── Save profile info ──────────────────────────────────────────────────────
  const handleSaveInfo = async () => {
    if (!(name || "").trim() || !(lastName || "").trim()) {
      toast.error("Nombre y apellido son obligatorios");
      return;
    }
    setSavingInfo(true);
    const result = await updateProfile({ name: (name || "").trim(), lastName: (lastName || "").trim() });
    setSavingInfo(false);
    if (result.success) {
      toast.success("Perfil actualizado correctamente");
    } else {
      toast.error(result.error ?? "Error al actualizar perfil");
    }
  };

  // ── Change password ────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!currentPassword) { toast.error("Ingresa tu contraseña actual"); return; }
    if (newPassword.length < 6) { toast.error("La nueva contraseña debe tener al menos 6 caracteres"); return; }
    if (newPassword !== confirmPassword) { toast.error("Las contraseñas no coinciden"); return; }
    if (currentPassword === newPassword) { toast.error("La nueva contraseña debe ser diferente a la actual"); return; }

    setSavingPwd(true);
    const { error } = await authApi.changePassword({ currentPassword, newPassword });
    setSavingPwd(false);

    if (error) {
      toast.error(error);
    } else {
      toast.success("Contraseña actualizada correctamente 🔐");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const pwdStrength = (() => {
    if (!newPassword) return null;
    if (newPassword.length < 6) return { label: "Muy corta", color: "bg-red-500", width: "w-1/4" };
    if (newPassword.length < 8) return { label: "Débil", color: "bg-amber-500", width: "w-2/4" };
    if (/[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword)) return { label: "Fuerte", color: "bg-green-500", width: "w-full" };
    return { label: "Aceptable", color: "bg-primary", width: "w-3/4" };
  })();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-5 border-b border-border">
          <div className="flex items-center gap-4">
            <Avatar className="w-14 h-14 border-2 border-primary/20 shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary font-bold text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <DialogTitle className="text-lg">{displayName}</DialogTitle>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              {user?.role && (
                <span className="inline-block mt-1 text-[10px] uppercase tracking-wider font-semibold text-primary/80 bg-primary/10 px-2 py-0.5 rounded">
                  {user.role}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs defaultValue="info" className="px-6 py-5">
          <TabsList className="w-full mb-5 grid grid-cols-2 bg-secondary/50">
            <TabsTrigger value="info" className="gap-2">
              <User className="w-4 h-4" />
              Información
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <ShieldCheck className="w-4 h-4" />
              Seguridad
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Información personal ────────────────────────────────── */}
          <TabsContent value="info" className="space-y-4 mt-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Nombre</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="bg-secondary/50 border-border h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-lastname">Apellido</Label>
                <Input
                  id="profile-lastname"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Tu apellido"
                  className="bg-secondary/50 border-border h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-email" className="text-muted-foreground">
                Email
              </Label>
              <Input
                id="profile-email"
                value={user?.email ?? ""}
                disabled
                className="bg-secondary/30 border-border h-11 text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                El email no se puede cambiar desde aquí.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                id="profile-save-info-btn"
                onClick={handleSaveInfo}
                disabled={savingInfo || !infoIsDirty}
                className="gradient-primary glow-primary font-semibold min-w-[140px]"
              >
                {savingInfo ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar cambios
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* ── Tab: Seguridad ───────────────────────────────────────────── */}
          <TabsContent value="security" className="space-y-4 mt-0">
            <div className="space-y-2">
              <Label htmlFor="profile-current-pwd">Contraseña actual</Label>
              <PasswordInput
                id="profile-current-pwd"
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder="Tu contraseña actual"
                disabled={savingPwd}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-new-pwd">Nueva contraseña</Label>
              <PasswordInput
                id="profile-new-pwd"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Mínimo 6 caracteres"
                disabled={savingPwd}
              />
              {/* Strength bar */}
              {pwdStrength && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        pwdStrength.color,
                        pwdStrength.width
                      )}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{pwdStrength.label}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-confirm-pwd">Confirmar nueva contraseña</Label>
              <PasswordInput
                id="profile-confirm-pwd"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repite la nueva contraseña"
                disabled={savingPwd}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                id="profile-change-pwd-btn"
                onClick={handleChangePassword}
                disabled={savingPwd || !currentPassword || !newPassword || !confirmPassword}
                className="font-semibold min-w-[160px] bg-secondary hover:bg-secondary/80 text-foreground border border-border"
              >
                {savingPwd ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cambiando...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 mr-2" />
                    Cambiar contraseña
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
