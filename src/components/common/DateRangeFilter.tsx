import { useMemo, useState } from "react";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DIA_MS = 86_400_000;
const FORMATO = "yyyy-MM-dd";

/** Fecha local como AAAA-MM-DD (no UTC: de noche en Lima «hoy» no debe saltar a mañana). */
export const aIso = (d: Date) => format(d, FORMATO);
const deIso = (s: string) => parse(s, FORMATO, new Date());

export const PRESETS_DE_DIAS = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "90 días", days: 90 },
];

export interface RangoDeFechas {
  /** Días hacia atrás si es un atajo; null si es un rango personalizado. */
  days: number | null;
  /** Primer y último día, inclusive, como AAAA-MM-DD. */
  from: string;
  to: string;
}

export function rangoDeUltimosDias(days: number): RangoDeFechas {
  const hoy = new Date();
  return { days, from: aIso(new Date(hoy.getTime() - (days - 1) * DIA_MS)), to: aIso(hoy) };
}

/** Rango de fechas con atajos (7/30/90 días) y un calendario para elegir días exactos. */
export function useRangoDeFechas(diasIniciales = 30) {
  const [rango, setRango] = useState<RangoDeFechas>(() => rangoDeUltimosDias(diasIniciales));
  return [rango, setRango] as const;
}

export function DateRangeFilter({
  value,
  onChange,
  presets = PRESETS_DE_DIAS,
}: {
  value: RangoDeFechas;
  onChange: (r: RangoDeFechas) => void;
  presets?: { label: string; days: number }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState<DateRange | undefined>(undefined);

  const personalizado = value.days === null;
  const etiqueta = useMemo(() => {
    if (!personalizado) return "Personalizado";
    const d = deIso(value.from);
    const h = deIso(value.to);
    return value.from === value.to
      ? format(d, "d MMM yyyy", { locale: es })
      : `${format(d, "d MMM", { locale: es })} – ${format(h, "d MMM yyyy", { locale: es })}`;
  }, [personalizado, value.from, value.to]);

  const aplicar = (r: DateRange | undefined) => {
    if (!r?.from) return;
    const hasta = r.to ?? r.from;
    onChange({ days: null, from: aIso(r.from), to: aIso(hasta) });
    setAbierto(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map((p) => (
        <Button
          key={p.days}
          size="sm"
          variant={value.days === p.days ? "default" : "outline"}
          onClick={() => onChange(rangoDeUltimosDias(p.days))}
        >
          {p.label}
        </Button>
      ))}
      <Popover
        open={abierto}
        onOpenChange={(o) => {
          setAbierto(o);
          if (o) setBorrador(personalizado ? { from: deIso(value.from), to: deIso(value.to) } : undefined);
        }}
      >
        <PopoverTrigger asChild>
          <Button size="sm" variant={personalizado ? "default" : "outline"} className="gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            {etiqueta}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="range"
            locale={es}
            numberOfMonths={1}
            selected={borrador}
            onSelect={setBorrador}
            disabled={{ after: new Date() }}
            defaultMonth={borrador?.from ?? new Date()}
            initialFocus
          />
          <div className="flex items-center justify-between gap-2 border-t border-border p-3">
            <p className="text-xs text-muted-foreground">
              {borrador?.from ? (borrador.to ? "Rango elegido" : "Elige el último día (o aplica solo este)") : "Elige el primer día"}
            </p>
            <Button size="sm" disabled={!borrador?.from} onClick={() => aplicar(borrador)}>
              Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
