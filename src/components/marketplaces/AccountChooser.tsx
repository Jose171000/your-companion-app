import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MarketplaceConnection, syncApi } from "@/lib/sync-api";
import { cn } from "@/lib/utils";
import { channelName } from "./format";

/** Cuentas elegidas por canal: { mercadolibre: [idCuenta, …] }. */
export type CuentasPorCanal = Record<string, string[]>;

/** Canales que se publican desde Synkro. */
const PUBLICABLES = ["mercadolibre", "falabella"];

const nombreDeCuenta = (c: MarketplaceConnection) => c.label || c.externalNickname || c.externalUserId || "Cuenta";

function memoria(canal: string): string[] | null {
  try {
    const tienda = localStorage.getItem("active_store_id") ?? "";
    const guardado = localStorage.getItem(`synkro_cuentas_${tienda}_${canal}`);
    return guardado ? (JSON.parse(guardado) as string[]) : null;
  } catch {
    return null;
  }
}

function recordar(canal: string, ids: string[]) {
  try {
    const tienda = localStorage.getItem("active_store_id") ?? "";
    localStorage.setItem(`synkro_cuentas_${tienda}_${canal}`, JSON.stringify(ids));
  } catch {
    /* sin almacenamiento: solo no se recuerda la elección */
  }
}

/** Las cuentas activas de la tienda agrupadas por canal. */
export function useCuentasPorCanal(habilitado = true) {
  const { data } = useQuery({ queryKey: ["sync-connections"], queryFn: () => syncApi.getConnections(), enabled: habilitado, staleTime: 30_000 });
  return useMemo(() => {
    const porCanal: Record<string, MarketplaceConnection[]> = {};
    for (const c of data?.data ?? []) {
      if (c.status !== "active") continue;
      (porCanal[c.marketplace] ??= []).push(c);
    }
    return porCanal;
  }, [data]);
}

interface Props {
  /** Canales marcados en pantalla: solo se pregunta por los que tienen más de una cuenta. */
  canales: string[];
  value: CuentasPorCanal;
  onChange: (v: CuentasPorCanal) => void;
  className?: string;
}

/**
 * Cuando una tienda tiene varias cuentas de un canal (hasta 3), deja elegir en cuáles publicar. Con una sola cuenta no
 * muestra nada. Al inicio quedan marcadas las que se usaron la última vez, o todas si es la primera.
 */
export function AccountChooser({ canales, value, onChange, className }: Props) {
  const porCanal = useCuentasPorCanal();
  const conVarias = canales.filter((c) => PUBLICABLES.includes(c) && (porCanal[c]?.length ?? 0) > 1);

  // Valores iniciales (lo recordado o todas) y limpieza de cuentas que ya no están activas.
  useEffect(() => {
    let cambio = false;
    const siguiente = { ...value };
    for (const canal of conVarias) {
      const activas = porCanal[canal].map((c) => c.id);
      const actual = siguiente[canal];
      if (actual === undefined) {
        const recordadas = (memoria(canal) ?? []).filter((id) => activas.includes(id));
        siguiente[canal] = recordadas.length ? recordadas : activas;
        cambio = true;
      } else {
        const vigentes = actual.filter((id) => activas.includes(id));
        if (vigentes.length !== actual.length || !vigentes.length) {
          siguiente[canal] = vigentes.length ? vigentes : activas;
          cambio = true;
        }
      }
    }
    if (cambio) onChange(siguiente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conVarias.join(","), Object.values(porCanal).flat().map((c) => c.id).join(",")]);

  if (!conVarias.length) return null;

  const alternar = (canal: string, id: string) => {
    const elegidas = value[canal] ?? [];
    const nuevas = elegidas.includes(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id];
    if (!nuevas.length) return; // siempre queda al menos una cuenta
    recordar(canal, nuevas);
    onChange({ ...value, [canal]: nuevas });
  };

  return (
    <div className={cn("space-y-3", className)}>
      {conVarias.map((canal) => (
        <div key={canal} className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-sm font-medium">¿En qué cuenta de {channelName(canal)} quieres publicar?</p>
          <div className="flex flex-wrap gap-2">
            {porCanal[canal].map((c) => {
              const marcada = (value[canal] ?? []).includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => alternar(canal, c.id)}
                  aria-pressed={marcada}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors",
                    marcada ? "border-[#FCCB34] bg-[#FCCB34]/15 text-foreground font-medium" : "border-border text-muted-foreground hover:border-[#FCCB34]/50",
                  )}
                >
                  <span className={cn("w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px]", marcada ? "bg-[#FCCB34] border-[#FCCB34] text-black" : "border-border")}>{marcada ? "✓" : ""}</span>
                  {nombreDeCuenta(c)}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">Puedes marcar una o varias. Se recordará tu elección.</p>
        </div>
      ))}
    </div>
  );
}
