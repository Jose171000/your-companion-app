import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { FalabellaImportSummary, MarketplaceConnection, syncApi } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ManualVariantsDialog } from "./ManualVariantsDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  /** Canal desde el que se importa */
  marketplace: "falabella" | "mercadolibre" | "woocommerce" | "shopify";
  /** Las cuentas de ese canal en la tienda activa */
  accounts: MarketplaceConnection[];
}

const CANAL = {
  falabella: "Falabella",
  mercadolibre: "Mercado Libre",
  woocommerce: "WooCommerce",
  shopify: "Shopify",
};

const ESTADOS: Record<string, string> = {
  published: "Publicadas",
  pending: "En revisión",
  paused: "Pausadas",
  error: "Rechazadas",
};

const accountName = (c: MarketplaceConnection) => c.label || c.externalNickname || c.externalUserId;

/**
 * Importa lo que el vendedor ya tiene en una cuenta de Falabella. Primero se
 * muestra una vista previa que no escribe nada; solo al confirmar se traen los
 * productos. Si la tienda tiene varias cuentas, se elige de cuál.
 */
/** El motivo completo puede ser largo (lo que dijo la IA): en la lista se muestra resumido. */
const motivoCorto = (motivo: string) => {
  const ia = motivo.split(". IA: ")[1];
  const texto = ia ? `la IA no pudo asignar valores con certeza. ${ia}` : motivo;
  return texto.length > 200 ? `${texto.slice(0, 200)}…` : texto;
};

export function ImportListingsDialog({ open, onOpenChange, marketplace, accounts }: Props) {
  const canal = CANAL[marketplace];
  const llamar = (dryRun: boolean, id: string) =>
    marketplace === "falabella"
      ? syncApi.importFalabellaListings(dryRun, id)
      : marketplace === "mercadolibre"
        ? syncApi.importMeliListings(dryRun, id)
        : syncApi.importChannelListings(marketplace, dryRun, id);
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState<string>("");
  const [preview, setPreview] = useState<FalabellaImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState<NonNullable<NonNullable<FalabellaImportSummary["variantes"]>["sinResolver"]>[number] | null>(null);

  const previewMutation = useMutation({
    mutationFn: (id: string) => llamar(true, id),
    onSuccess: (res) => {
      if (res.error || !res.data) setError(res.error ?? "No se pudo leer " + canal);
      else setPreview(res.data);
    },
    onError: () => setError("Error al conectar con el servidor"),
  });

  const importMutation = useMutation({
    mutationFn: () => llamar(false, accountId),
    onSuccess: (res) => {
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudo importar");
        return;
      }
      toast.success(`${canal}: ${res.data.enlazadas} publicaciones importadas`);
      queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  // Al abrir se parte de la primera cuenta; con una sola no hay nada que elegir.
  // Si la lista de cuentas se recarga mientras el diálogo está abierto, la cuenta elegida se conserva (solo cambia si ya no existe).
  useEffect(() => {
    if (open) setAccountId((actual) => (accounts.some((c) => c.id === actual) ? actual : accounts[0]?.id ?? ""));
  }, [open, accounts]);

  // Cada vez que cambia la cuenta (o se abre), se pide una vista previa nueva.
  useEffect(() => {
    if (!open || !accountId) return;
    setPreview(null);
    setError(null);
    previewMutation.mutate(accountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId]);

  return (
    <>
    <Dialog open={open && !manual} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-4 h-4" /> Importar desde {canal}
          </DialogTitle>
          <DialogDescription>
            Trae a esta tienda lo que ya tienes publicado en {canal} y lo enlaza a su catálogo.
          </DialogDescription>
        </DialogHeader>

        {accounts.length > 1 && (
          <div className="space-y-2">
            <Label>Cuenta de {canal}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{accountName(a)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!preview && !error && (
          <div className="flex items-center gap-3 py-8 justify-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Leyendo tu catálogo de {canal}…
          </div>
        )}

        {error && <p className="text-sm text-destructive py-4">{error}</p>}

        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-secondary/30 p-3">
                <p className="text-xl font-semibold tabular-nums">{preview.total}</p>
                <p className="text-[11px] text-muted-foreground">En {canal}</p>
              </div>
              <div className="rounded-xl bg-secondary/30 p-3">
                <p className="text-xl font-semibold tabular-nums">{preview.nuevas}</p>
                <p className="text-[11px] text-muted-foreground">Nuevos en la tienda</p>
              </div>
              <div className="rounded-xl bg-secondary/30 p-3">
                <p className="text-xl font-semibold tabular-nums">{preview.yaEnCatalogo}</p>
                <p className="text-[11px] text-muted-foreground">Ya en el catálogo</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(preview.porEstado).map(([estado, n]) => (
                <Badge key={estado} variant="secondary" className="text-[10px]">
                  {ESTADOS[estado] ?? estado}: {n}
                </Badge>
              ))}
              {preview.notaMedia != null && (
                <Badge variant="secondary" className="text-[10px]">
                  Nota media de calidad: {preview.notaMedia}/100
                </Badge>
              )}
            </div>

            {preview.variantes && (preview.variantes.grupos > 0 || preview.variantes.sinResolver.length > 0 || (preview.variantes.paginaPublica?.familias ?? 0) > 0 || (preview.variantes.yaAgrupadas ?? 0) > 0) && (
              <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2 text-xs max-h-[40vh] overflow-y-auto">
                {preview.variantes.grupos > 0 && (
                  <>
                    <p className="font-semibold">
                      {preview.variantes.grupos} producto(s) con variantes ({preview.variantes.variantes} fichas): se guardarán agrupados, cada variante con sus propias fotos.
                    </p>
                    <ul className="space-y-1">
                      {preview.variantes.ejemplos.map((g) => (
                        <li key={g.parentSku}>
                          <span className="font-medium">{g.nombre}</span> <span className="text-muted-foreground">· {g.variantes} variantes · </span>
                          {g.ejes.map((e) => `${e.name}: ${e.values.join(", ")}`).join(" — ")}
                        </li>
                      ))}
                      {preview.variantes.grupos > preview.variantes.ejemplos.length && (
                        <li className="text-muted-foreground">… y {preview.variantes.grupos - preview.variantes.ejemplos.length} más</li>
                      )}
                    </ul>
                  </>
                )}
                {(preview.variantes.yaAgrupadas ?? 0) > 0 && (
                  <p className="text-muted-foreground">
                    {preview.variantes.yaAgrupadas} {preview.variantes.yaAgrupadas === 1 ? "familia ya estaba agrupada" : "familias ya estaban agrupadas"} en Synkro: no se vuelven a proponer.
                  </p>
                )}
                {preview.variantes.ia && preview.variantes.ia.intentadas > 0 && (
                  <p className="text-muted-foreground">
                    La IA propuso los ejes de {preview.variantes.ia.intentadas} familias y se comprobaron contra los datos de cada ficha ({preview.variantes.ia.resueltas} aceptadas).
                  </p>
                )}
                {preview.variantes.paginaPublica && preview.variantes.paginaPublica.familias > 0 && (
                  <p className="text-muted-foreground">
                    Se leyó la página pública de Falabella de {preview.variantes.paginaPublica.leidas} de {preview.variantes.paginaPublica.familias} familias
                    para confirmar el color y la talla de cada variante ({preview.variantes.paginaPublica.resueltas} resueltas).
                    {preview.variantes.paginaPublica.bloqueada && " Falabella no permitió seguir leyendo: las demás quedan sin agrupar, nada se adivina."}
                    {preview.variantes.paginaPublica.pendientes > 0 && !preview.variantes.paginaPublica.bloqueada && ` Quedan ${preview.variantes.paginaPublica.pendientes} por leer: vuelve a importar para continuar.`}
                  </p>
                )}
                {preview.variantes.sinResolver.length > 0 && (
                  <div className="text-yellow-400 space-y-0.5">
                    <p>{preview.variantes.sinResolver.length} grupo(s) no se pudieron armar y se importarán como productos sueltos:</p>
                    {preview.variantes.sinResolver.slice(0, 8).map((g) => (
                      <div key={g.parentSku} className="flex items-start justify-between gap-2">
                        <p>· {g.titulo ? `${g.titulo} (${g.parentSku})` : g.parentSku}{g.skus.length > 0 ? ` (${g.skus.length} fichas)` : ""}: {motivoCorto(g.motivo)}</p>
                        {g.enlace && (g.fichas?.length ?? 0) < 2 && (
                          <a href={g.enlace} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-foreground hover:border-primary/50">Abrir en {canal}</a>
                        )}
                        {(g.fichas?.length ?? 0) > 1 && (
                          <Button variant="outline" size="sm" className="h-6 px-2 text-[11px] shrink-0 text-foreground" onClick={() => setManual(g)}>Estructurar</Button>
                        )}
                      </div>
                    ))}
                    {preview.variantes.sinResolver.length > 8 && <p>… y {preview.variantes.sinResolver.length - 8} más</p>}
                  </div>
                )}
              </div>
            )}

            {(preview.duplicados?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2 text-xs max-h-[40vh] overflow-y-auto">
                <p className="font-semibold">
                  {preview.duplicadas} publicación(es) repetidas en {preview.duplicados!.length} SKU: no son variantes, son el mismo producto publicado más de una vez.
                </p>
                <p className="text-muted-foreground">Solo la principal (activa y con más ventas) se enlaza con el producto. Las demás no se importan; puedes pausarlas o cerrarlas en Mercado Libre.</p>
                <ul className="space-y-2">
                  {preview.duplicados!.slice(0, 30).map((d) => (
                    <li key={d.sku} className="space-y-1">
                      <code className="font-mono">{d.sku}</code>
                      <ul className="space-y-0.5 pl-3">
                        {d.publicaciones.map((p) => (
                          <li key={p.externalId + (p.variationId ?? "")} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <Badge variant={p.principal ? "default" : "secondary"} className="text-[10px] py-0 px-1.5">{p.principal ? "Principal" : "Repetida"}</Badge>
                            <span className="font-mono text-[11px]">#{p.externalId.replace(/^MPE/, "")}</span>
                            <span className="text-muted-foreground">{p.estado === "published" ? "activa" : p.estado === "paused" ? "pausada" : p.estado} · {p.vendidas} vendidas · stock {p.stock}{p.precio != null ? ` · S/ ${p.precio}` : ""}{p.sincronizadaCon ? " · sincronizada" : ""}</span>
                            {p.permalink && <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="underline text-muted-foreground hover:text-foreground">Ver</a>}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                  {preview.duplicados!.length > 30 && <li className="text-muted-foreground">… y {preview.duplicados!.length - 30} SKU más</li>}
                </ul>
              </div>
            )}

            {(preview.sinSku ?? 0) > 0 && (
              <p className="text-xs text-yellow-400">
                {preview.sinSku} publicación(es) o variante(s) no tienen SKU y no se pueden enlazar. Ponles un SKU en {canal} y
                se traerán en la próxima importación.
              </p>
            )}

            {(preview.enOtraTienda ?? 0) > 0 && (
              <p className="text-xs text-yellow-400">
                {preview.enOtraTienda} publicación(es) tienen un SKU que ya existe en otra tienda tuya y no se importarán
                para no mezclar su stock.
              </p>
            )}

            {preview.incompleto && (
              <p className="text-xs text-yellow-400">
                {canal} tiene más publicaciones de las que se pueden leer de una vez. Se importará una parte;
                vuelve a ejecutar la importación para traer el resto.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Los productos nuevos se crean como borradores en el catálogo de la tienda. Lo que ya existe no se modifica.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="gradient-primary"
            disabled={!preview || preview.total === 0 || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending ? "Importando…" : `Importar ${preview?.total ?? ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ManualVariantsDialog familia={manual} onClose={() => setManual(null)} onDone={() => {
      // La familia ya quedó agrupada: sale de la lista al instante y la vista previa se vuelve a calcular en segundo plano.
      const agrupada = manual?.parentSku;
      setPreview((p) => (p?.variantes ? { ...p, variantes: { ...p.variantes, sinResolver: p.variantes.sinResolver.filter((g) => g.parentSku !== agrupada), yaAgrupadas: (p.variantes.yaAgrupadas ?? 0) + 1 } } : p));
      if (accountId) previewMutation.mutate(accountId);
    }} />
    </>
  );
}
