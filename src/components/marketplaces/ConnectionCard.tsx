import { MarketplaceConnection } from "@/lib/sync-api";
import { MarketplaceDef } from "./MarketplacesModule";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link2, Loader2, Plus, Unlink } from "lucide-react";

interface ConnectionCardProps {
  marketplace: MarketplaceDef;
  /** Las cuentas de este canal que la tienda tiene conectadas (hasta `maxAccounts`) */
  connections: MarketplaceConnection[];
  maxAccounts: number;
  /** Solo el dueño de la tienda conecta y desconecta cuentas */
  canManage: boolean;
  isLoading: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: (connection: MarketplaceConnection) => void;
}

export function ConnectionCard({
  marketplace,
  connections,
  maxAccounts,
  canManage,
  isLoading,
  isConnecting,
  onConnect,
  onDisconnect,
}: ConnectionCardProps) {
  const total = connections.length;
  const isConnected = connections.some((c) => c.status === "active");
  const full = total >= maxAccounts;

  return (
    <div
      className={cn(
        "glass rounded-2xl p-4 md:p-5 border transition-all duration-200",
        isConnected ? "border-primary/40" : "border-border",
        !marketplace.available && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-16 h-11 md:w-20 md:h-12 rounded-[8px] flex items-center justify-center bg-transparent dark:bg-[#EAEAEA] px-2 py-1 shrink-0 overflow-hidden">
            {marketplace.logo ? (
              <img
                src={marketplace.logo}
                alt={marketplace.name}
                className={cn("w-full h-full object-contain", marketplace.imgClass)}
              />
            ) : (
              // Canales sin logo PNG: se dibuja el nombre corto en su lugar.
              <span className="text-[13px] md:text-sm font-bold tracking-tight text-[#111]">
                {marketplace.logoText ?? marketplace.name}
              </span>
            )}
          </div>
          <div>
            <p className="font-semibold text-sm md:text-base">{marketplace.name}</p>
            {isLoading ? (
              <Skeleton className="h-3 w-24 mt-1" />
            ) : (
              <p className="text-xs text-muted-foreground">
                {!marketplace.available
                  ? "Próximamente"
                  : total === 0
                    ? "No conectado"
                    : `${total} de ${maxAccounts} cuentas`}
              </p>
            )}
          </div>
        </div>

        {isConnected && (
          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[10px] shrink-0">
            Conectado
          </Badge>
        )}
      </div>

      {total > 0 && (
        <ul className="mt-4 space-y-2">
          {connections.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-secondary/20 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{c.label || c.externalNickname || c.externalUserId}</p>
                {c.label && (c.externalNickname || c.externalUserId) && (
                  <p className="text-[11px] text-muted-foreground truncate">{c.externalNickname || c.externalUserId}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.status === "error" && (
                  <Badge className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px]">Reconectar</Badge>
                )}
                {canManage && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 hover:text-destructive hover:border-destructive/50"
                    aria-label={`Desconectar ${c.label || c.externalNickname || c.externalUserId}`}
                    onClick={() => onDisconnect(c)}
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        {!marketplace.available ? (
          <Button size="sm" className="w-full" disabled>
            <Link2 className="w-3.5 h-3.5 mr-2" />
            Próximamente
          </Button>
        ) : !canManage ? (
          total === 0 && (
            <p className="text-xs text-muted-foreground">Solo el dueño de la tienda puede conectar cuentas.</p>
          )
        ) : full ? (
          <p className="text-xs text-muted-foreground text-center">
            Máximo {maxAccounts} cuentas. Desconecta una para agregar otra.
          </p>
        ) : (
          <Button
            size="sm"
            className="w-full"
            variant={total === 0 ? "default" : "outline"}
            disabled={isLoading || isConnecting}
            onClick={onConnect}
          >
            {isConnecting ? (
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            ) : total === 0 ? (
              <Link2 className="w-3.5 h-3.5 mr-2" />
            ) : (
              <Plus className="w-3.5 h-3.5 mr-2" />
            )}
            {total === 0 ? "Conectar" : `Agregar otra cuenta (${total}/${maxAccounts})`}
          </Button>
        )}
      </div>
    </div>
  );
}
