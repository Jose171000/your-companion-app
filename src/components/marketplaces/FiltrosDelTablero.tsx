import { useState } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CuentaConectada } from "./calidad";
import { channelName } from "./format";
import { FILTROS_INICIALES, FiltrosDelTablero, OrdenDelTablero, STOCK_BAJO, filtrosActivos } from "./filtros";

interface Props {
  filtros: FiltrosDelTablero;
  onChange: (f: FiltrosDelTablero) => void;
  cuentas: CuentaConectada[];
  /** Productos que quedan con los filtros y el total del tablero. */
  mostrados: number;
  total: number;
}

const TODOS = "todos";

/** Una lista desplegable con una opción «todas» (el componente de listas no admite valores vacíos). */
function Lista({ id, etiqueta, valor, onChange, todas, opciones }: { id: string; etiqueta: string; valor: string; onChange: (v: string) => void; todas?: string; opciones: { v: string; t: string }[] }) {
  return (
    <div className="space-y-1 min-w-0">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{etiqueta}</Label>
      <Select value={valor === "" ? TODOS : valor} onValueChange={(v) => onChange(v === TODOS ? "" : v)}>
        <SelectTrigger id={id} className="h-9 w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {todas && <SelectItem value={TODOS}>{todas}</SelectItem>}
          {opciones.map((o) => <SelectItem key={o.v} value={o.v}>{o.t}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Filtros y orden del Tablero: un botón que abre el panel (en el celular se apilan en dos columnas). */
export function FiltrosDelTableroPanel({ filtros, onChange, cuentas, mostrados, total }: Props) {
  const [abierto, setAbierto] = useState(false);
  const activos = filtrosActivos(filtros);
  const poner = <K extends keyof FiltrosDelTablero>(k: K, v: FiltrosDelTablero[K]) => onChange({ ...filtros, [k]: v });
  const interruptor = (k: "pendientes" | "desfasados" | "descuento", texto: string) => (
    <Button
      key={k}
      type="button"
      size="sm"
      variant={filtros[k] ? "default" : "outline"}
      className={cn("h-8 text-xs", filtros[k] && "gradient-primary")}
      aria-pressed={filtros[k]}
      onClick={() => poner(k, !filtros[k])}
    >
      {texto}
    </Button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
          <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros
          {activos > 0 && <Badge className="ml-0.5 h-4 px-1.5 text-[10px] gradient-primary">{activos}</Badge>}
          {abierto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">{mostrados === total ? `${total} producto${total === 1 ? "" : "s"}` : `${mostrados} de ${total} productos`}</span>
        {activos > 0 && (
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground" onClick={() => onChange({ ...FILTROS_INICIALES, orden: filtros.orden })}>
            <X className="w-3.5 h-3.5" /> Limpiar filtros
          </Button>
        )}
      </div>

      {abierto && (
        <div className="glass rounded-2xl p-3 sm:p-4 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Lista
              id="f-cuenta" etiqueta="Canal / cuenta" valor={filtros.cuenta} onChange={(v) => poner("cuenta", v)} todas="Todas"
              opciones={cuentas.map((c) => ({ v: c.id, t: `${channelName(c.marketplace)}${c.label ? ` · ${c.label}` : ""}` }))}
            />
            <Lista
              id="f-estado" etiqueta="Estado de la publicación" valor={filtros.estado} onChange={(v) => poner("estado", v as FiltrosDelTablero["estado"])} todas="Cualquiera"
              opciones={[{ v: "published", t: "Activa" }, { v: "pending", t: "En proceso" }, { v: "paused", t: "Pausada" }, { v: "error", t: "Con error" }, { v: "none", t: "Sin publicar" }]}
            />
            <Lista
              id="f-calidad" etiqueta="Calidad" valor={filtros.calidad} onChange={(v) => poner("calidad", v as FiltrosDelTablero["calidad"])} todas="Cualquiera"
              opciones={[{ v: "completa", t: "Al 100 %" }, { v: "incompleta", t: "Por debajo del 100 %" }, { v: "baja", t: "Por debajo del 50 %" }]}
            />
            <Lista
              id="f-stock" etiqueta="Stock" valor={filtros.stock} onChange={(v) => poner("stock", v as FiltrosDelTablero["stock"])} todas="Cualquiera"
              opciones={[{ v: "con", t: "Con stock" }, { v: "sin", t: "Sin stock" }, { v: "bajo", t: `Bajo (1 a ${STOCK_BAJO})` }]}
            />
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="flex flex-wrap gap-2">
              {interruptor("pendientes", "Con cambios por aprobar")}
              {interruptor("desfasados", "Canal distinto a Synkro")}
              {interruptor("descuento", "Con descuento")}
            </div>
            <div className="w-full sm:w-52">
              <Lista
                id="f-orden" etiqueta="Ordenar por" valor={filtros.orden} onChange={(v) => poner("orden", v as OrdenDelTablero)}
                opciones={[{ v: "nombre", t: "Nombre (A-Z)" }, { v: "calidad", t: "Calidad (menor primero)" }, { v: "stock", t: "Stock (menor primero)" }, { v: "precio", t: "Precio (menor primero)" }]}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
