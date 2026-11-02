import { cn } from "@/lib/utils";
import { SALE_STATES, SaleState } from "@/lib/sale-status";

/**
 * Filtro por estado de la venta (pendiente, enviado, entregado, cancelado, devuelto). Se pueden marcar varios;
 * sin ninguno marcado se muestran todas. Cada opción muestra cuántas ventas hay en ese estado.
 */
export function SaleStatusFilter({ value, onChange, counts }: {
  value: SaleState[];
  onChange: (next: SaleState[]) => void;
  counts?: Partial<Record<SaleState, number>>;
}) {
  const toggle = (e: SaleState) => onChange(value.includes(e) ? value.filter((x) => x !== e) : [...value, e]);
  return (
    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filtrar por estado de la venta">
      <button
        type="button"
        onClick={() => onChange([])}
        className={cn("h-8 px-3 rounded-full border text-xs transition-colors", value.length === 0 ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}
      >
        Todas
      </button>
      {SALE_STATES.map((e) => {
        const activo = value.includes(e.value);
        return (
          <button
            key={e.value}
            type="button"
            aria-pressed={activo}
            onClick={() => toggle(e.value)}
            className={cn("h-8 px-3 rounded-full border text-xs transition-colors tabular-nums", activo ? e.clase : "border-border text-muted-foreground hover:text-foreground")}
          >
            {e.label}{counts?.[e.value] != null ? ` · ${counts[e.value]}` : ""}
          </button>
        );
      })}
    </div>
  );
}
