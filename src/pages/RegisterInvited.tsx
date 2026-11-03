import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { PENDING_INVITATION_KEY } from '@/contexts/StoreContext';
import { storesApi, ROLE_LABELS, StoreRole } from '@/lib/stores-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthShell, authButtonClass, authInputClass } from '@/components/auth/AuthShell';
import { Loader2 } from 'lucide-react';
import { PrivacyCheckbox } from '@/components/activity/PrivacyNotice';

const labelClass = 'text-sm font-medium text-[#111111] dark:text-[#F8F8F5]';

/**
 * Registro corto de una persona invitada al equipo de una tienda. No es una empresa nueva: no pide RUC, razón social ni
 * nombre de tienda, el correo es el de la invitación y entra directo, con la tienda ya activa.
 */
export default function RegisterInvited() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { register, isAuthenticated } = useAuth();

  const info = useQuery({
    queryKey: ['invitation-info', token],
    queryFn: () => storesApi.invitationInfo(token),
    enabled: !!token,
    retry: false,
  });
  const invitacion = info.data?.data;

  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cellPhone, setCellPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [aceptaAviso, setAceptaAviso] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!invitacion) return;
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    if (!aceptaAviso) { setError('Debes aceptar el aviso de privacidad para crear tu cuenta.'); return; }

    setIsLoading(true);
    const result = await register({
      email: invitacion.email,
      password,
      name: name.trim(),
      lastName: lastName.trim(),
      invitationToken: token,
      acceptPrivacy: true,
      ...(cellPhone.trim() ? { cellPhone: cellPhone.trim() } : {}),
    });
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || 'No se pudo crear la cuenta');
      return;
    }
    // La invitación ya se aceptó al registrarse: no queda nada pendiente.
    try { localStorage.removeItem(PENDING_INVITATION_KEY); } catch { /* sin almacenamiento */ }
    navigate('/', { replace: true });
  };

  if (!token || info.isLoading || !invitacion) {
    return (
      <AuthShell title="Invitación a una tienda" subtitle="">
        {info.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-red-600">
              {info.data?.error ?? (token ? 'La invitación no es válida o ya caducó. Pide una nueva al dueño de la tienda.' : 'El enlace de invitación está incompleto.')}
            </p>
            <Link to="/login" className="inline-block text-sm font-medium text-[#111111] dark:text-[#FCCB34] hover:underline">Ir a iniciar sesión</Link>
          </div>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Únete a ${invitacion.storeName}`}
      subtitle={`${invitacion.inviterName ?? 'El dueño de la tienda'} te invitó como ${invitacion.roleName ?? ROLE_LABELS[invitacion.role as StoreRole] ?? invitacion.role}. Crea tu acceso, no necesitas registrar una empresa.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-700">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className={labelClass}>Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isLoading} className={authInputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className={labelClass}>Apellido</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={isLoading} className={authInputClass} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email" className={labelClass}>Correo electrónico</Label>
            <Input id="email" type="email" value={invitacion.email} readOnly disabled className={authInputClass} />
            <p className="text-[11px] text-[#999999]">Es el correo al que llegó la invitación.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cellPhone" className={labelClass}>Celular (opcional)</Label>
            <Input id="cellPhone" type="tel" placeholder="999 999 999" value={cellPhone} onChange={(e) => setCellPhone(e.target.value)} disabled={isLoading} className={authInputClass} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="password" className={labelClass}>Contraseña</Label>
            <Input id="password" type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} className={authInputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className={labelClass}>Confirmar contraseña</Label>
            <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isLoading} className={authInputClass} />
          </div>
        </div>

        <PrivacyCheckbox checked={aceptaAviso} onChange={setAceptaAviso} disabled={isLoading} />

        <Button type="submit" disabled={isLoading} className={authButtonClass}>
          {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando tu acceso…</>) : 'Crear mi acceso y entrar'}
        </Button>

        <p className="text-sm text-[#666666] dark:text-[#A1A1AA] text-center">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-[#111111] dark:text-[#FCCB34] hover:underline font-medium">Inicia sesión</Link>
          {' '}con ese mismo correo y la invitación se acepta sola.
        </p>
      </form>
    </AuthShell>
  );
}
