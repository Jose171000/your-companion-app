import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthShell, authButtonClass, authInputClass } from '@/components/auth/AuthShell';
import { CheckCircle2, Loader2 } from 'lucide-react';

const labelClass = 'text-sm font-medium text-[#111111] dark:text-[#F8F8F5]';

/** RUC peruano: 11 dígitos que empiezan con 10, 15, 16, 17 o 20. */
const RUC_VALIDO = /^(10|15|16|17|20)\d{9}$/;

export default function Register() {
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [cellPhone, setCellPhone] = useState('');
  const [nameCompany, setNameCompany] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [ruc, setRuc] = useState('');
  const [url, setUrl] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [enviada, setEnviada] = useState<string | null>(null);

  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!RUC_VALIDO.test(ruc.trim())) {
      setError('El RUC debe tener 11 dígitos y empezar con 10, 15, 16, 17 o 20.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);
    const result = await register({
      email: email.trim(),
      password,
      name: name.trim(),
      lastName: lastName.trim(),
      nameCompany: nameCompany.trim(),
      businessName: businessName.trim(),
      ruc: ruc.trim(),
      ...(url.trim() ? { url: url.trim() } : {}),
      ...(cellPhone.trim() ? { cellPhone: cellPhone.trim() } : {}),
    });
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || 'Error al registrarse');
      return;
    }
    // Las cuentas nuevas esperan aprobación: no se inicia sesión, se explica qué sigue.
    // (Quien llega con una invitación entra directo y la app lo redirige sola.)
    if (result.pending) setEnviada(result.message || 'Recibimos tu solicitud.');
  };

  if (enviada) {
    return (
      <AuthShell title="Recibimos tu solicitud" subtitle="Estamos revisando los datos de tu empresa">
        <div className="space-y-6 text-center">
          <CheckCircle2 className="w-14 h-14 mx-auto text-[#F5B800]" />
          <p className="text-sm leading-relaxed text-[#444444] dark:text-[#A1A1AA]">{enviada}</p>
          <p className="text-xs text-[#666666] dark:text-[#A1A1AA]">
            Te enviamos un correo a <span className="font-semibold">{email.trim()}</span> con la confirmación. Cuando aprobemos tu
            cuenta crearemos tu tienda y podrás entrar a conectar tus canales.
          </p>
          <Link to="/login" className="inline-block text-sm font-medium text-[#111111] dark:text-[#FCCB34] hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Crear cuenta" subtitle="Cuéntanos de tu negocio. Revisaremos tus datos antes de activar tu cuenta.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-700">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <p className="text-xs font-semibold uppercase tracking-wider text-[#999999]">Tus datos</p>
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
            <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} className={authInputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cellPhone" className={labelClass}>Celular (opcional)</Label>
            <Input id="cellPhone" type="tel" placeholder="999 999 999" value={cellPhone} onChange={(e) => setCellPhone(e.target.value)} disabled={isLoading} className={authInputClass} />
          </div>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wider text-[#999999] pt-2">Tu empresa</p>
        <div className="space-y-2">
          <Label htmlFor="nameCompany" className={labelClass}>Nombre de tu tienda</Label>
          <Input id="nameCompany" placeholder="Ej. Laihome" value={nameCompany} onChange={(e) => setNameCompany(e.target.value)} required disabled={isLoading} className={authInputClass} />
          <p className="text-[11px] text-[#999999]">Con este nombre crearemos tu tienda cuando aprobemos tu cuenta.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="businessName" className={labelClass}>Razón social</Label>
            <Input id="businessName" placeholder="Ej. LAIHOME S.A.C." value={businessName} onChange={(e) => setBusinessName(e.target.value)} required disabled={isLoading} className={authInputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ruc" className={labelClass}>RUC</Label>
            <Input id="ruc" inputMode="numeric" maxLength={11} placeholder="11 dígitos" value={ruc} onChange={(e) => setRuc(e.target.value.replace(/\D/g, ''))} required disabled={isLoading} className={authInputClass} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="url" className={labelClass}>Página web (opcional)</Label>
          <Input id="url" placeholder="https://mitienda.com" value={url} onChange={(e) => setUrl(e.target.value)} disabled={isLoading} className={authInputClass} />
          <p className="text-[11px] text-[#999999]">Si vendes solo en marketplaces, puedes poner el enlace de tu perfil de vendedor.</p>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wider text-[#999999] pt-2">Acceso</p>
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

        <Button type="submit" disabled={isLoading} className={authButtonClass}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando solicitud…
            </>
          ) : (
            'Solicitar mi cuenta'
          )}
        </Button>

        <p className="text-sm text-[#666666] dark:text-[#A1A1AA] text-center">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-[#111111] dark:text-[#FCCB34] hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
