import { ProductsSummary } from "@/lib/products-api";
import { cn } from "@/lib/utils";

export type EstadoFiltro = "" | "sin-categoria" | "sin-publicar" | "con-error" | "incompletos";

const ITEMS: { id: EstadoFiltro; label: string; campo: keyof ProductsSummary; alerta?: boolean }[] = [
  { id: "", label: "Todos", campo: "total" },
  { id: "incompletos", label: "Incompletos", campo: "incompletos", alerta: true },
  { id: "sin-categoria", label: "Sin categoría", campo: "sinCategoria", alerta: true },
  { id: "sin-publicar", label: "Sin publicar", campo: "sinPublicar" },
  { id: "con-error", label: "Con error", campo: "conError", alerta: true },
];

/** Cuántos productos hay en cada situación; cada contador filtra la lista. */
export function ProductsSummaryBar({ summary, value, onChange }: { summary?: ProductsSummary; value: EstadoFiltro; onChange: (v: EstadoFiltro) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ITEMS.map((i) => {
        const n = summary?.[i.campo];
        const activo = value === i.id;
        return (
          <button
            key={i.id || "todos"}
            type="button"
            onClick={() => onChange(activo ? "" : i.id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs transition-colors",
              activo ? "border-[#FCCB34] bg-[#FCCB34]/15" : "border-border text-muted-foreground hover:border-[#FCCB34]/50",
            )}
          >
            {i.label}
            <span className={cn("ml-1.5 font-semibold tabular-nums", i.alerta && n ? "text-yellow-400" : "text-foreground")}>{n ?? "…"}</span>
          </button>
        );
      })}
    </div>
  );
}
