import { MarketplaceConnection } from "@/lib/sync-api";
import { MarketplaceDef } from "./MarketplacesModule";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link2, Loader2, Unlink } from "lucide-react";

interface ConnectionCardProps {
  marketplace: MarketplaceDef;
  connection?: MarketplaceConnection;
  isLoading: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: (connection: MarketplaceConnection) => void;
}

export function ConnectionCard({
  marketplace,
  connection,
  isLoading,
  isConnecting,
  onConnect,
  onDisconnect,
}: ConnectionCardProps) {
  const isConnected = connection?.status === "active";

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
            <img
              src={marketplace.logo}
              alt={marketplace.name}
              className={cn("w-full h-full object-contain", marketplace.imgClass)}
            />
          </div>
          <div>
            <p className="font-semibold text-sm md:text-base">{marketplace.name}</p>
            {isLoading ? (
              <Skeleton className="h-3 w-24 mt-1" />
            ) : isConnected ? (
              <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                {connection.externalNickname || connection.externalUserId}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {marketplace.available ? "No conectado" : "Próximamente"}
              </p>
            )}
          </div>
        </div>

        {isConnected && (
          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[10px] shrink-0">
            Conectado
          </Badge>
        )}
        {connection?.status === "error" && (
          <Badge className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px] shrink-0">
            Reconectar
          </Badge>
        )}
      </div>

      <div className="mt-4">
        {isConnected ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full hover:text-destructive hover:border-destructive/50"
            onClick={() => onDisconnect(connection)}
          >
            <Unlink className="w-3.5 h-3.5 mr-2" />
            Desconectar
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full"
            disabled={!marketplace.available || isLoading || isConnecting}
            onClick={onConnect}
          >
            {isConnecting ? (
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            ) : (
              <Link2 className="w-3.5 h-3.5 mr-2" />
            )}
            {marketplace.available ? "Conectar" : "Próximamente"}
          </Button>
        )}
      </div>
    </div>
  );
}
