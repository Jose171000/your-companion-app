import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { syncApi, MarketplaceConnection } from "@/lib/sync-api";
import { ConnectionCard } from "./ConnectionCard";
import { ListingsTable } from "./ListingsTable";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Marketplaces disponibles ─────────────────────────────────────────────────

export interface MarketplaceDef {
  id: string;
  name: string;
  logo: string;
  imgClass?: string;
  available: boolean;
}

// Mismos logos PNG de /public que usa MarketplaceSelector
const MARKETPLACES: MarketplaceDef[] = [
  { id: "mercadolibre", name: "MercadoLibre", logo: "/mercadolibre.png", available: true },
  { id: "shopify",      name: "Shopify",      logo: "/shopify.png",      available: false },
  { id: "amazon",       name: "Amazon",       logo: "/amazon.png",       imgClass: "scale-[1.7]", available: false },
];

// ─── Módulo principal ─────────────────────────────────────────────────────────

export function MarketplacesModule() {
  const queryClient = useQueryClient();
  const [disconnectTarget, setDisconnectTarget] = useState<MarketplaceConnection | null>(null);

  // ── Resultado del flujo OAuth (query params que deja el callback) ──────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const meli = params.get("meli");
    if (!meli) return;

    if (meli === "connected") {
      const nickname = params.get("nickname");
      toast.success(
        nickname
          ? `Cuenta de Mercado Libre conectada: ${nickname}`
          : "Cuenta de Mercado Libre conectada"
      );
      queryClient.invalidateQueries({ queryKey: ["sync-connections"] });
    } else if (meli === "error") {
      toast.error(params.get("message") || "Error al conectar con Mercado Libre");
    }
    // Limpia los query params sin recargar la página
    window.history.replaceState({}, "", window.location.pathname);
  }, [queryClient]);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: connectionsResult, isLoading: loadingConnections } = useQuery({
    queryKey: ["sync-connections"],
    queryFn:  () => syncApi.getConnections(),
    staleTime: 30_000,
  });

  const { data: listingsResult, isLoading: loadingListings, isError: listingsError } = useQuery({
    queryKey: ["sync-listings"],
    queryFn:  () => syncApi.getListings(),
    staleTime: 15_000,
    refetchInterval: 20_000, // las publicaciones encoladas cambian de estado solas
  });

  const connections = connectionsResult?.data ?? [];
  const listings    = listingsResult?.data ?? [];

  // ── Mutations ──────────────────────────────────────────────────────────────
  const connectMutation = useMutation({
    mutationFn: () => syncApi.getMeliAuthUrl(),
    onSuccess: (res) => {
      if (res.error || !res.data?.authUrl) {
        toast.error(res.error || "No se pudo generar la URL de autorización");
        return;
      }
      // Redirige a Mercado Libre; su callback nos trae de vuelta al dashboard
      window.location.href = res.data.authUrl;
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const disconnectMutation = useMutation({
    mutationFn: (marketplace: string) => syncApi.disconnect(marketplace),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Cuenta desconectada");
        queryClient.invalidateQueries({ queryKey: ["sync-connections"] });
      }
      setDisconnectTarget(null);
    },
    onError: () => {
      toast.error("Error al desconectar la cuenta");
      setDisconnectTarget(null);
    },
  });

  const handleConnect = (marketplaceId: string) => {
    if (marketplaceId === "mercadolibre") connectMutation.mutate();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Conexiones */}
      <section className="space-y-4">
        <div>
          <h3 className="font-semibold text-base md:text-lg">Canales de venta</h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Conecta tus cuentas para publicar y sincronizar inventario automáticamente
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {MARKETPLACES.map((mp) => (
            <ConnectionCard
              key={mp.id}
              marketplace={mp}
              connection={connections.find((c) => c.marketplace === mp.id)}
              isLoading={loadingConnections}
              isConnecting={connectMutation.isPending && mp.id === "mercadolibre"}
              onConnect={() => handleConnect(mp.id)}
              onDisconnect={(conn) => setDisconnectTarget(conn)}
            />
          ))}
        </div>
      </section>

      {/* Publicaciones */}
      <section className="space-y-4">
        <div>
          <h3 className="font-semibold text-base md:text-lg">Publicaciones sincronizadas</h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Productos publicados en tus canales y su estado de sincronización
          </p>
        </div>

        <ListingsTable
          listings={listings}
          isLoading={loadingListings}
          isError={listingsError}
        />
      </section>

      {/* Confirmación de desconexión */}
      <AlertDialog
        open={disconnectTarget !== null}
        onOpenChange={(open) => !open && setDisconnectTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desconectar Mercado Libre?</AlertDialogTitle>
            <AlertDialogDescription>
              La cuenta{" "}
              <span className="font-semibold">
                {disconnectTarget?.externalNickname || disconnectTarget?.externalUserId}
              </span>{" "}
              dejará de sincronizarse. Tus publicaciones existentes en Mercado Libre no
              se eliminan, pero Synkro ya no podrá actualizarlas ni recibir sus ventas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                disconnectTarget && disconnectMutation.mutate(disconnectTarget.marketplace)
              }
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
