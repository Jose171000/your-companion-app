import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { syncApi, MarketplaceConnection } from "@/lib/sync-api";
import { ConnectionCard } from "./ConnectionCard";
import { ConnectYavendioDialog } from "./ConnectYavendioDialog";
import { ConnectFalabellaDialog } from "./ConnectFalabellaDialog";
import { ListingsTable } from "./ListingsTable";
import { InventoryBoard } from "./InventoryBoard";
import { ImportListingsDialog } from "./ImportListingsDialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { ReviewQueue } from "./ReviewQueue";
import { SalesList } from "./SalesList";
import { useStores } from "@/contexts/StoreContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  /** PNG en /public. Si falta, la tarjeta dibuja `logoText`. */
  logo?: string;
  logoText?: string;
  imgClass?: string;
  available: boolean;
}

// Mismos logos PNG de /public que usa MarketplaceSelector
const MARKETPLACES: MarketplaceDef[] = [
  { id: "mercadolibre", name: "MercadoLibre", logo: "/mercadolibre.png", available: true },
  { id: "yavendio",     name: "Yavendió",     logoText: "yavendió",      available: true },
  { id: "falabella",    name: "Falabella",    logo: "/Falabella.png",    available: true },
  { id: "shopify",      name: "Shopify",      logo: "/shopify.png",      available: false },
  { id: "amazon",       name: "Amazon",       logo: "/amazon.png",       imgClass: "scale-[1.7]", available: false },
];

/** Cuántas cuentas del mismo canal admite una tienda (el servidor lo hace cumplir). */
const MAX_ACCOUNTS = 3;

// ─── Módulo principal ─────────────────────────────────────────────────────────

export function MarketplacesModule() {
  const queryClient = useQueryClient();
  const { activeStore, setActiveStore } = useStores();
  const storeId = activeStore?.id;
  // Roles: el lector mira; el editor propone cambios; el dueño conecta, importa y aprueba.
  const isOwner = activeStore?.role === "owner";
  const canEdit = activeStore?.role === "owner" || activeStore?.role === "editor";
  const [disconnectTarget, setDisconnectTarget] = useState<MarketplaceConnection | null>(null);
  const [yavendioOpen, setYavendioOpen] = useState(false);
  const [falabellaOpen, setFalabellaOpen] = useState(false);
  const [importFrom, setImportFrom] = useState<"falabella" | "mercadolibre" | null>(null);

  // ── Resultado del flujo OAuth (query params que deja el callback) ──────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const meli = params.get("meli");
    if (!meli) return;

    if (meli === "connected") {
      const nickname = params.get("nickname");
      // La cuenta se conectó a una tienda concreta: se muestra esa.
      const store = params.get("store");
      if (store) setActiveStore(store);
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
  }, [queryClient, setActiveStore]);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: connectionsResult, isLoading: loadingConnections } = useQuery({
    queryKey: ["sync-connections", storeId],
    queryFn:  () => syncApi.getConnections(),
    enabled:  !!storeId,
    staleTime: 30_000,
  });

  const { data: listingsResult, isLoading: loadingListings, isError: listingsError } = useQuery({
    queryKey: ["sync-listings", storeId],
    queryFn:  () => syncApi.getListings(),
    enabled:  !!storeId,
    staleTime: 15_000,
    refetchInterval: 20_000, // las publicaciones encoladas cambian de estado solas
  });

  // Modo revisión: ajuste del usuario y cambios de precio/stock por aprobar
  const { data: settingsResult } = useQuery({
    queryKey: ["sync-settings", storeId],
    queryFn:  () => syncApi.getSyncSettings(),
    enabled:  !!storeId,
    staleTime: 30_000,
  });

  const { data: changesResult, isLoading: loadingChanges } = useQuery({
    queryKey: ["sync-change-requests", storeId],
    queryFn:  () => syncApi.getChangeRequests(),
    enabled:  !!storeId,
    staleTime: 10_000,
    refetchInterval: 20_000, // los envíos aprobados pasan a "enviado" solos
  });

  const connections = connectionsResult?.data ?? [];
  const listings    = listingsResult?.data ?? [];
  const changes     = changesResult?.data ?? [];
  const pendingChanges = changes.filter((c) => c.status === "pending");
  const falabellaAccounts = connections.filter((c) => c.marketplace === "falabella" && c.status === "active");
  const meliAccounts = connections.filter((c) => c.marketplace === "mercadolibre" && c.status === "active");
  // Hasta que el servidor responda se asume revisión: es el valor por defecto.
  const reviewMode  = settingsResult?.data?.reviewMode ?? true;

  // Vuelve a leer ahora el estado de las publicaciones (también se hace solo cada 30 minutos).
  const refreshMutation = useMutation({
    mutationFn: () => syncApi.refreshListings(),
    onSuccess: (res) => {
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudieron actualizar las publicaciones");
        return;
      }
      const n = res.data.cuentas.reduce((t, c) => t + c.actualizadas, 0);
      const falla = res.data.cuentas.find((c) => c.error);
      toast.success(`Publicaciones al día: ${n} actualizadas`);
      if (falla) toast.error(`${falla.nombre}: ${falla.error}`);
      queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

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
    mutationFn: (connectionId: string) => syncApi.disconnect(connectionId),
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
    // Mercado Libre sale a su pantalla de autorización (OAuth);
    // Yavendió se conecta pegando una API key aquí mismo.
    if (marketplaceId === "mercadolibre") connectMutation.mutate();
    if (marketplaceId === "yavendio") setYavendioOpen(true);
    if (marketplaceId === "falabella") setFalabellaOpen(true);
  };

  // El texto del aviso de desconexión depende del canal.
  const disconnectName =
    MARKETPLACES.find((m) => m.id === disconnectTarget?.marketplace)?.name ??
    disconnectTarget?.marketplace ??
    "";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <Tabs defaultValue="canales">
        <TabsList>
          <TabsTrigger value="canales">Canales</TabsTrigger>
          <TabsTrigger value="tablero">Tablero</TabsTrigger>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="revision">
            Revisión{pendingChanges.length > 0 ? ` (${pendingChanges.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tablero" className="pt-6">
          <InventoryBoard
            listings={listings}
            pending={pendingChanges}
            reviewMode={reviewMode}
            canEdit={canEdit}
            isLoading={loadingListings}
            isError={listingsError}
          />
        </TabsContent>

        <TabsContent value="ventas" className="pt-6">
          <SalesList accounts={connections} canImport={isOwner} />
        </TabsContent>

        <TabsContent value="revision" className="pt-6">
          <ReviewQueue requests={changes} reviewMode={reviewMode} canManage={isOwner} isLoading={loadingChanges} />
        </TabsContent>

        <TabsContent value="canales" className="pt-6 space-y-8">
      {/* Conexiones */}
      <section className="space-y-4">
        <div>
          <h3 className="font-semibold text-base md:text-lg">Canales de venta{activeStore ? ` de ${activeStore.name}` : ""}</h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Cada tienda tiene sus propias cuentas: hasta {MAX_ACCOUNTS} por canal. Cambia de tienda en la cabecera para ver las de otra.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {MARKETPLACES.map((mp) => (
            <ConnectionCard
              key={mp.id}
              marketplace={mp}
              connections={connections.filter((c) => c.marketplace === mp.id)}
              maxAccounts={MAX_ACCOUNTS}
              canManage={isOwner}
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-base md:text-lg">Publicaciones sincronizadas</h3>
            <p className="text-xs md:text-sm text-muted-foreground">
              Productos publicados en tus canales y su estado de sincronización
            </p>
          </div>
          {isOwner && (falabellaAccounts.length > 0 || meliAccounts.length > 0) && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5" disabled={refreshMutation.isPending} onClick={() => refreshMutation.mutate()}>
                {refreshMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Actualizar ahora
              </Button>
              {falabellaAccounts.length > 0 && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportFrom("falabella")}>
                  <Download className="w-3.5 h-3.5" /> Importar desde Falabella
                </Button>
              )}
              {meliAccounts.length > 0 && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportFrom("mercadolibre")}>
                  <Download className="w-3.5 h-3.5" /> Importar desde Mercado Libre
                </Button>
              )}
            </div>
          )}
        </div>

        <ListingsTable
          listings={listings}
          isLoading={loadingListings}
          isError={listingsError}
        />
      </section>
        </TabsContent>
      </Tabs>

      {/* Confirmación de desconexión */}
      <AlertDialog
        open={disconnectTarget !== null}
        onOpenChange={(open) => !open && setDisconnectTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desconectar {disconnectName}?</AlertDialogTitle>
            <AlertDialogDescription>
              La cuenta{" "}
              <span className="font-semibold">
                {disconnectTarget?.label || disconnectTarget?.externalNickname || disconnectTarget?.externalUserId}
              </span>{" "}
              dejará de sincronizarse en esta tienda. Lo que ya exista en {disconnectName} no se elimina,
              pero Synkro ya no podrá actualizarlo ni recibir sus datos. Si vuelves a conectarla, recupera sus publicaciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                disconnectTarget && disconnectMutation.mutate(disconnectTarget.id)
              }
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConnectYavendioDialog open={yavendioOpen} onOpenChange={setYavendioOpen} />
      <ConnectFalabellaDialog open={falabellaOpen} onOpenChange={setFalabellaOpen} />
      <ImportListingsDialog
        open={importFrom !== null}
        onOpenChange={(o) => { if (!o) setImportFrom(null); }}
        marketplace={importFrom ?? "falabella"}
        accounts={importFrom === "mercadolibre" ? meliAccounts : falabellaAccounts}
      />
    </div>
  );
}
