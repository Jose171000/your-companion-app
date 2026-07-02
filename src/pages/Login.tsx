import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, TrendingUp, Tags } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login({ email, password });
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Error al iniciar sesión');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8" style={{ background: 'radial-gradient(circle at top left, #FFE38A 0%, #FCCB34 35%, #F5B800 100%)' }}>
      
      {/* Abstract background shapes for SaaS feel */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-white/20 blur-[80px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-black/5 blur-[100px]"></div>
      </div>

      {/* Main Container */}
      <div className="relative w-full max-w-[900px] bg-white dark:bg-[#111111] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col md:flex-row border border-white/40 dark:border-white/10 transition-colors duration-200">
        
        {/* Form Section */}
        <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-white dark:bg-[#111111] z-10 transition-colors duration-200">
          
          <div className="mb-10 text-center">
            {/* Logo */}
            <div className="mb-6 flex justify-center">
              <img src="/logo_synkro.png" alt="Synkro AI Logo" className="h-20 md:h-24 w-auto object-contain" />
            </div>
            <h1 className="text-3xl font-bold text-[#111111] dark:text-[#F8F8F5] mb-3 tracking-tight">
              Bienvenido a Synkro AI
            </h1>
            <p className="text-[#666666] dark:text-[#A1A1AA] text-sm md:text-base leading-relaxed">
              Optimiza tus productos y publícalos mejor con inteligencia artificial.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-700">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-[#111111] dark:text-[#F8F8F5]">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 bg-white dark:bg-[#1A1A1A] border-[#E6D28A] dark:border-[#333333] focus-visible:ring-[#FCCB34] focus-visible:border-[#FCCB34] transition-all rounded-xl px-4 dark:text-[#F8F8F5]"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-[#111111] dark:text-[#F8F8F5]">Contraseña</Label>
                <a href="#" className="text-sm font-medium text-[#666666] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white transition-colors">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 bg-white dark:bg-[#1A1A1A] border-[#E6D28A] dark:border-[#333333] focus-visible:ring-[#FCCB34] focus-visible:border-[#FCCB34] transition-all rounded-xl px-4 dark:text-[#F8F8F5]"
              />
            </div>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-12 bg-[#111111] dark:bg-[#FCCB34] hover:bg-[#222222] dark:hover:bg-[#E6B620] text-white dark:text-[#111111] font-medium rounded-xl text-base transition-all shadow-[0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_20px_rgba(0,0,0,0.15)] mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
            
            <p className="text-sm text-center text-[#666666] dark:text-[#A1A1AA] mt-6">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-[#111111] dark:text-white hover:text-[#FCCB34] dark:hover:text-[#FCCB34] font-semibold transition-colors">
                Regístrate
              </Link>
            </p>
          </form>
        </div>

        {/* Benefits Section */}
        <div className="hidden md:flex w-full md:w-1/2 bg-[#F8F8F5] dark:bg-[#1A1A1A] p-12 flex-col justify-center border-l border-border dark:border-[#333333] relative overflow-hidden transition-colors duration-200">
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#FCCB34] opacity-5 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3"></div>
          
          <div className="relative z-10 space-y-8 max-w-sm mx-auto">
            <h2 className="text-2xl font-bold text-[#111111] dark:text-[#F8F8F5] leading-tight">
              Lleva tu catálogo al siguiente nivel
            </h2>

            <div className="space-y-6">
              {/* Benefit 1 */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#222222] shadow-sm flex items-center justify-center shrink-0 border border-[#EAEAEA] dark:border-[#333333]">
                  <TrendingUp className="w-5 h-5 text-[#FCCB34]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#111111] dark:text-[#F8F8F5] mb-1">SEO optimizado</h3>
                  <p className="text-sm text-[#666666] dark:text-[#A1A1AA] leading-relaxed">Títulos creados específicamente para rankear mejor en marketplaces.</p>
                </div>
              </div>

              {/* Benefit 2 */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#222222] shadow-sm flex items-center justify-center shrink-0 border border-[#EAEAEA] dark:border-[#333333]">
                  <Sparkles className="w-5 h-5 text-[#FCCB34]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#111111] dark:text-[#F8F8F5] mb-1">Descripciones con IA</h3>
                  <p className="text-sm text-[#666666] dark:text-[#A1A1AA] leading-relaxed">Textos persuasivos que resaltan los beneficios y aumentan conversión.</p>
                </div>
              </div>

              {/* Benefit 3 */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#222222] shadow-sm flex items-center justify-center shrink-0 border border-[#EAEAEA] dark:border-[#333333]">
                  <Tags className="w-5 h-5 text-[#FCCB34]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#111111] dark:text-[#F8F8F5] mb-1">Atributos automáticos</h3>
                  <p className="text-sm text-[#666666] dark:text-[#A1A1AA] leading-relaxed">Completa fichas técnicas de forma inteligente y ahorra horas de trabajo.</p>
                </div>
              </div>
            </div>
            
            {/* Visual SaaS mock element */}
            <div className="mt-10 p-4 bg-white dark:bg-[#222222] rounded-2xl shadow-sm border border-[#EAEAEA] dark:border-[#333333] flex items-center gap-3 opacity-90 transform hover:scale-[1.02] transition-transform">
              <div className="w-2 h-2 rounded-full bg-[#FCCB34] animate-pulse"></div>
              <p className="text-xs font-medium text-[#111111] dark:text-[#F8F8F5]">Synkro AI procesando +10,000 productos hoy</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
