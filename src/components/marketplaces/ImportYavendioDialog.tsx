import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Link2, ShoppingCart } from "lucide-react";
import { syncApi, MarketplaceConnection, YavendioPedidosResultado, YavendioSugerencia } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cuentas de Yavendió activas de la tienda. */
  accounts: MarketplaceConnection[];
}

const confianzaTexto: Record<YavendioSugerencia["confianza"], string> = {
  alta: "Segura",
  posible: "Revisar",
  ninguna: "Sin coincidencia",
};

const accountName = (c: MarketplaceConnection) => c.label || c.externalNickname || c.externalUserId;

/**
 * Trae lo que ya existe en Yavendió.
 *
 * Productos: Yavendió no usa SKU, así que Synkro propone con qué producto corresponde cada variante (por nombre) y
 * quien importa confirma. Solo las coincidencias seguras vienen marcadas. Vincular no escribe nada en Yavendió.
 * Ventas: los pedidos confirmados pasan a las ventas de la tienda; primero se ve qué entraría.
 */
export function ImportYavendioDialog({ open, onOpenChange, accounts }: Props) {
  const queryClient = useQueryClient();
  const [connectionId, setConnectionId] = useState<string | undefined>(accounts[0]?.id);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [pedidos, setPedidos] = useState<YavendioPedidosResultado | null>(null);

  useEffect(() => {
    if (open) setConnectionId((actual) => (accounts.some((a) => a.id === actual) ? actual : accounts[0]?.id));
  }, [open, accounts]);

  const preview = useQuery({
    queryKey: ["yavendio-import-products", connectionId],
    queryFn: () => syncApi.yavendioPreviewProducts(connectionId),
    enabled: open && !!connectionId,
    staleTime: 0,
    gcTime: 0,
  });
  const vista = preview.data?.data;
  const errorDeVista = preview.data?.error;

  // Al llegar la lista, quedan marcadas solo las coincidencias seguras.
  useEffect(() => {
    if (!vista) return;
    setMarcadas(new Set(vista.variantes.filter((v) => !v.vinculadaA && v.confianza === "alta").map((v) => v.variantId)));
  }, [vista]);

  useEffect(() => {
    if (!open) setPedidos(null);
  }, [open]);

  const pendientes = useMemo(() => (vista?.variantes ?? []).filter((v) => !v.vinculadaA), [vista]);

  // Dos variantes marcadas hacia el mismo producto no se pueden vincular a la vez.
  const repetidos = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const v of pendientes) {
      if (marcadas.has(v.variantId) && v.sugerido) cuenta.set(v.sugerido.productId, (cuenta.get(v.sugerido.productId) ?? 0) + 1);
    }
    return new Set([...cuenta].filter(([, n]) => n > 1).map(([id]) => id));
  }, [pendientes, marcadas]);

  const alternar = (id: string) =>
    setMarcadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const vincular = useMutation({
    mutationFn: () => {
      const links = pendientes
        .filter((v) => marcadas.has(v.variantId) && v.sugerido)
        .map((v) => ({ productId: v.sugerido!.productId, variantId: v.variantId }));
      return syncApi.yavendioLinkProducts(links, connectionId);
    },
    onSuccess: (res) => {
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudo vincular");
        return;
      }
      const { vinculadas, rechazadas, ventasCompletadas } = res.data;
      toast.success(
        `${vinculadas} vinculadas${ventasCompletadas ? ` · ${ventasCompletadas} ventas anteriores completadas` : ""}`,
      );
      if (rechazadas.length) toast.error(`${rechazadas.length} no se pudieron vincular: ${rechazadas[0].motivo}`);
      queryClient.invalidateQueries({ queryKey: ["yavendio-import-products"] });
      queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const traerVentas = useMutation({
    mutationFn: (dryRun: boolean) => syncApi.yavendioImportOrders(dryRun, connectionId).then((res) => ({ res, dryRun })),
    onSuccess: ({ res, dryRun }) => {
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudieron leer los pedidos");
        return;
      }
      setPedidos(res.data);
      if (!dryRun) {
        toast.success(`Ventas importadas: ${res.data.nuevos} nuevas`);
        queryClient.invalidateQueries({ queryKey: ["sync-orders"] });
      }
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const seleccionadas = pendientes.filter((v) => marcadas.has(v.variantId) && v.sugerido).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar desde Yavendió</DialogTitle>
          <DialogDescription>
            Yavendió no usa SKU: cada variante se vincula con su producto de Synkro por su identificador interno.
            Aquí no se escribe nada en Yavendió.
          </DialogDescription>
        </DialogHeader>

        {accounts.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <Button
                key={a.id}
                size="sm"
                variant={a.id === connectionId ? "default" : "outline"}
                onClick={() => { setConnectionId(a.id); setPedidos(null); }}
              >
                {accountName(a)}
              </Button>
            ))}
          </div>
        )}

        <Tabs defaultValue="productos" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="productos" className="gap-1.5"><Link2 className="w-3.5 h-3.5" /> Productos</TabsTrigger>
            <TabsTrigger value="ventas" className="gap-1.5"><ShoppingCart className="w-3.5 h-3.5" /> Ventas</TabsTrigger>
          </TabsList>

          <TabsContent value="productos" className="space-y-3 overflow-y-auto min-h-0">
            {preview.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : errorDeVista || !vista ? (
              <p className="text-sm text-destructive">{errorDeVista ?? "No se pudo leer Yavendió."}</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{vista.totalVariantes} variantes en Yavendió</Badge>
                  <Badge variant="outline">{vista.yaVinculadas} ya vinculadas</Badge>
                  <Badge variant="outline">{vista.coincidenciasSeguras} seguras</Badge>
                  <Badge variant="outline">{vista.coincidenciasPosibles} por revisar</Badge>
                  <Badge variant="outline">{vista.sinCoincidencia} sin coincidencia</Badge>
                </div>

                {pendientes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay variantes pendientes de vincular.</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {pendientes.map((v) => {
                      const choque = !!v.sugerido && repetidos.has(v.sugerido.productId) && marcadas.has(v.variantId);
                      return (
                        <li key={v.variantId} className="flex items-start gap-3 p-3">
                          <Checkbox
                            className="mt-1"
                            checked={marcadas.has(v.variantId)}
                            disabled={!v.sugerido}
                            onCheckedChange={() => alternar(v.variantId)}
                            aria-label={`Vincular ${v.variantName}`}
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-medium truncate">
                              {v.yavendioProductName} <span className="text-muted-foreground">· {v.variantName}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {v.price !== null ? `Precio ${v.price.toFixed(2)}` : "Sin precio"} ·{" "}
                              {v.available ? "Disponible" : "No disponible"} · YV-{v.variantId}
                            </p>
                            {v.sugerido ? (
                              <p className="text-xs">
                                → <span className="font-semibold">{v.sugerido.sku}</span> {v.sugerido.name}{" "}
                                <span className="text-muted-foreground">({v.sugerido.motivo})</span>
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Ningún producto de Synkro se le parece. Créalo en Synkro y vuelve a abrir esta pantalla.
                              </p>
                            )}
                            {v.avisos.map((a) => (
                              <p key={a} className="text-xs text-amber-600">{a}</p>
                            ))}
                            {choque && (
                              <p className="text-xs text-destructive">Otra variante marcada apunta a este mismo producto: deja solo una.</p>
                            )}
                          </div>
                          <Badge variant={v.confianza === "alta" ? "default" : "outline"} className="shrink-0">
                            {confianzaTexto[v.confianza]}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="ventas" className="space-y-3 overflow-y-auto min-h-0">
            <p className="text-sm text-muted-foreground">
              Los pedidos confirmados de Yavendió se suman a las ventas de la tienda, con los de los demás canales. No se
              descuenta stock ni se mandan correos. Los cancelados o rechazados no cuentan, y repetir no duplica.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={traerVentas.isPending || !connectionId} onClick={() => traerVentas.mutate(true)}>
                {traerVentas.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                Ver qué entraría
              </Button>
              <Button
                size="sm"
                disabled={traerVentas.isPending || !pedidos || pedidos.nuevos === 0}
                onClick={() => traerVentas.mutate(false)}
              >
                Importar {pedidos ? pedidos.nuevos : ""} ventas
              </Button>
            </div>

            {pedidos && (
              <div className="space-y-2 text-sm">
                <p>
                  {pedidos.nuevos} nuevas · {pedidos.actualizados} actualizadas · {pedidos.anulados} anuladas ·{" "}
                  {pedidos.omitidos} sin confirmar, de {pedidos.revisados} pedidos revisados (últimos 90 días).
                </p>
                {pedidos.pendientesPorTraer > 0 && (
                  <p className="text-xs text-amber-600">
                    Quedan {pedidos.pendientesPorTraer} pedidos por traer: vuelve a importar para seguir.
                  </p>
                )}
                {pedidos.lineasSinVincular.length > 0 && (
                  <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-xs font-medium">Productos vendidos que aún no están vinculados a Synkro:</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {pedidos.lineasSinVincular.map((l, i) => (
                        <li key={`${l.pedido}-${i}`}>
                          Pedido {l.pedido} · {l.producto} · {l.variantId ? `YV-${l.variantId}` : "sin identificar"}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      Vincúlalos en la pestaña Productos: las ventas antiguas se completan solas.
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button
            onClick={() => vincular.mutate()}
            disabled={vincular.isPending || seleccionadas === 0 || repetidos.size > 0}
          >
            {vincular.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
            Vincular {seleccionadas} seleccionadas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
