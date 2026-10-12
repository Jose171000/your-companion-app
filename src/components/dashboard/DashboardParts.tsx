import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Piezas compartidas por los paneles del dashboard (cliente y agencia). */

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("glass rounded-2xl border border-border p-4 md:p-5", className)}>{children}</div>;
}

export function Kpi({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-2xl md:text-3xl font-bold tracking-tight mt-1 truncate",
              tone === "warning" && "text-amber-500",
              tone === "danger" && "text-destructive",
              tone === "success" && "text-green-500"
            )}
          >
            {value}
          </p>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            tone === "warning" ? "bg-amber-500/10" : tone === "danger" ? "bg-destructive/10" : tone === "success" ? "bg-green-500/10" : "bg-primary/10"
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h3 className="font-semibold text-base md:text-lg">{title}</h3>
      {subtitle && <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function LoadingGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20 mt-2" />
        </Card>
      ))}
    </div>
  );
}

/** Fecha corta «15 nov. 2026» a partir de YYYY-MM-DD (sin saltos de zona horaria). */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

/** Texto del estado de un pago: «Vence en 4 días», «Venció hace 2 días»… */
export function textoDePago(estado: string | null, dias: number | null): string {
  if (estado === null || dias === null) return "Sin fecha";
  if (estado === "vence_hoy") return "Vence hoy";
  if (estado === "vencido") return `Venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "día" : "días"}`;
  return `Vence en ${dias} ${dias === 1 ? "día" : "días"}`;
}

export const TONO_DE_PAGO: Record<string, string> = {
  al_dia: "bg-green-500/10 text-green-500 border-green-500/30",
  por_vencer: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  vence_hoy: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  vencido: "bg-destructive/10 text-destructive border-destructive/30",
};

export const NOMBRE_DE_MODELO: Record<string, string> = {
  ninguno: "Sin plan",
  fijo: "Cuota fija",
  comision: "Comisión",
  mixto: "Cuota + comisión",
};

export const NOMBRE_DE_FRECUENCIA: Record<string, string> = {
  mensual: "al mes",
  trimestral: "por trimestre",
  anual: "al año",
};
