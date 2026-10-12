import { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/**
 * Contenedor visual compartido por las pantallas de acceso
 * (login, recuperar contraseña, restablecer contraseña).
 */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 md:p-8"
      style={{ background: "radial-gradient(circle at top left, #FFE38A 0%, #FCCB34 35%, #F5B800 100%)" }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-white/20 blur-[80px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-black/5 blur-[100px]"></div>
      </div>

      <div className="relative w-full max-w-md sm:max-w-xl bg-white dark:bg-[#111111] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden border border-white/40 dark:border-white/10 transition-colors duration-200">
        <div className="p-8 md:p-12">
          <div className="mb-8 text-center">
            <div className="mb-6 flex justify-center">
              <img src="/logo_synkro.png" alt="Synkro AI" className="h-16 md:h-20 w-auto object-contain" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#111111] dark:text-[#F8F8F5] mb-3 tracking-tight">
              {title}
            </h1>
            <p className="text-[#666666] dark:text-[#A1A1AA] text-sm leading-relaxed">{subtitle}</p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

/** Clases compartidas de los inputs para mantener el mismo look del login */
export const authInputClass =
  "h-12 bg-white dark:bg-[#1A1A1A] border-[#E6D28A] dark:border-[#333333] focus-visible:ring-[#FCCB34] focus-visible:border-[#FCCB34] transition-all rounded-xl px-4 dark:text-[#F8F8F5]";

/** Clases compartidas del botón principal */
export const authButtonClass =
  "w-full h-12 bg-[#111111] dark:bg-[#FCCB34] hover:bg-[#222222] dark:hover:bg-[#E6B620] text-white dark:text-[#111111] font-medium rounded-xl text-base transition-all shadow-[0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_20px_rgba(0,0,0,0.15)]";
