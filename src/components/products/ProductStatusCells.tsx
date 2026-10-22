import { AlertCircle, CheckCircle2 } from "lucide-react";
import { ProductOverview } from "@/lib/products-api";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ESTADO_ESTILO: Record<string, string> = {
  published: "bg-green-500/10 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  paused: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
};

/** Categoría real que tiene el producto en cada canal; sin ninguna, un aviso claro. */
export function CategoryCell({ overview, loading }: { overview?: ProductOverview; loading?: boolean }) {
  if (!overview) return <span className="text-sm text-muted-foreground">{loading ? "…" : "—"}</span>;
  const { falabella, mercadolibre, internal } = overview.categories;
  if (!falabella && !mercadolibre && !internal) {
    return <span className="text-xs font-medium text-red-400">Sin categoría</span>;
  }
  return (
    <div className="space-y-0.5 text-xs leading-tight max-w-[240px]">
      {falabella && (
        <p className="truncate" title={falabella.path ?? `Categoría ${falabella.id}`}>
          <span className="text-muted-foreground">Falabella: </span>
          {falabella.path ?? `ID ${falabella.id}`}
        </p>
      )}
      {mercadolibre && (
        <p className="truncate">
          <span className="text-muted-foreground">Mercado Libre: </span>ID {mercadolibre.id}
        </p>
      )}
      {internal && <p className="truncate text-muted-foreground">{internal}</p>}
    </div>
  );
}

/** Estado real de cada publicación (con cuenta y motivo del error); si no hay ninguna, «Sin publicar». */
export function ChannelsCell({ overview, intended, loading }: { overview?: ProductOverview; intended: string[]; loading?: boolean }) {
  if (!overview) {
    return <span className="text-sm text-muted-foreground">{loading ? "…" : intended.length ? intended.join(", ") : "—"}</span>;
  }
  if (!overview.channels.length) {
    return (
      <div className="space-y-1">
        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Sin publicar</Badge>
        {intended.length > 0 && <p className="text-[10px] text-muted-foreground capitalize">Destino: {intended.join(", ")}</p>}
      </div>
    );
  }
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-1">
        {overview.channels.map((c) => {
          const chip = (
            <div key={c.linkId} className="flex items-center gap-1.5 text-xs">
              <span className="font-medium truncate max-w-[110px]">
                {c.channel}
                {c.account && <span className="font-normal text-muted-foreground"> · {c.account}</span>}
              </span>
              <Badge className={cn("text-[10px] gap-1 py-0 px-1.5", ESTADO_ESTILO[c.status] ?? ESTADO_ESTILO.pending)}>
                {c.status === "error" && <AlertCircle className="w-3 h-3" />}
                {c.statusLabel}
              </Badge>
            </div>
          );
          if (!c.error) return chip;
          return (
            <Tooltip key={c.linkId}>
              <TooltipTrigger asChild>{chip}</TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{c.error}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

/** «Listo» o «Faltan N datos»; al hacer clic muestra qué falta, en general y por canal. */
export function CompletenessCell({ overview, loading }: { overview?: ProductOverview; loading?: boolean }) {
  if (!overview) return <span className="text-sm text-muted-foreground">{loading ? "…" : "—"}</span>;
  const { ready, missing, byChannel } = overview.completeness;
  if (ready) {
    return (
      <Badge className="text-[10px] gap-1 bg-green-500/10 text-green-400 border-green-500/30">
        <CheckCircle2 className="w-3 h-3" /> Listo
      </Badge>
    );
  }
  const porCanal = Object.entries(byChannel).filter(([, v]) => !v.ready);
  const total = missing.length + porCanal.reduce((n, [, v]) => n + v.missing.length, 0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="text-left">
          <Badge className="text-[10px] gap-1 cursor-pointer bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
            <AlertCircle className="w-3 h-3" /> Faltan {total}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3 text-xs">
        {missing.length > 0 && (
          <div>
            <p className="font-semibold mb-1">Para publicar en cualquier canal</p>
            <ul className="list-disc pl-4 space-y-0.5">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        )}
        {porCanal.map(([canal, v]) => (
          <div key={canal}>
            <p className="font-semibold mb-1 capitalize">Para {canal}</p>
            <ul className="list-disc pl-4 space-y-0.5">{v.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        ))}
        <p className="text-muted-foreground">Complétalo desde Editar, Ficha o Preparar para Falabella.</p>
      </PopoverContent>
    </Popover>
  );
}
