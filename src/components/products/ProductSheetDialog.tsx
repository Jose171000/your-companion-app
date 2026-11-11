import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Download, ExternalLink, FileText, Loader2, Plug, RefreshCw, Rocket, Save, Sparkles } from "lucide-react";
import { Product, productsApi } from "@/lib/products-api";
import { SheetChannel, SheetData, SheetPrice, SheetSync, syncApi } from "@/lib/sync-api";
import { useStores } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { GroupPriceForm } from "@/components/marketplaces/GroupPriceForm";

const NOMBRE_CANAL: Record<string, string> = { falabella: "Falabella", mercadolibre: "Mercado Libre", woocommerce: "WooCommerce", shopify: "Shopify", ripley: "Ripley" };

const ESTADO: Record<string, { texto: string; clase: string }> = {
  published: { texto: "Publicado", clase: "bg-green-500/10 text-green-500" },
  pending: { texto: "Enviando", clase: "bg-amber-500/10 text-amber-500" },
  error: { texto: "Con error", clase: "bg-red-500/10 text-red-500" },
  paused: { texto: "Pausado", clase: "bg-secondary text-muted-foreground" },
};

interface Borrador {
  name: string;
  aiTitle: string;
  aiDescription: string;
  descriptionHtml: string;
  brand: string;
  medidas: { width: string; length: string; height: string; weight: string };
  /** Atributos de la categoría de Falabella (nombre técnico → valor). */
  atributos: Record<string, string>;
  /** Atributos de Mercado Libre (id → valor). */
  atributosMeli: Record<string, string>;
  /** Precio y descuento propios de cada cuenta (connectionId → valores); vacío usa el del producto. */
  precios: Record<string, PrecioPropio>;
}

interface PrecioPropio { price: string; salePrice: string; saleStart: string; saleEnd: string }

const ORIGEN_PRECIO: Record<string, string> = { propio: "fijado para este canal", producto: "el del producto", canal: "el que el canal ya tenía" };

/** Atributos que cambian de una variante a otra (color, talla…): en el modo «todas las variantes» no se editan. */
const claveDe = (t: string) => String(t ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const esPropioDeVariante = (nombre: string, ejes: string[]) => ["color", "colorbasico", "maincolor", "talla", "size", ...ejes.map(claveDe)].includes(claveDe(nombre));

function borradorDe(hoja: SheetData, nombreDelGrupo?: string): Borrador {
  const fal = hoja.channels.find((c) => c.marketplace === "falabella");
  const meli = hoja.channels.find((c) => c.marketplace === "mercadolibre");
  const p = hoja.product;
  return {
    name: p.name,
    // En el modo grupo el título común es el del grupo (el de cada variante lleva su color y talla).
    aiTitle: nombreDelGrupo ?? p.aiTitle ?? "",
    aiDescription: p.aiDescription ?? "",
    descriptionHtml: p.descriptionHtml ?? "",
    brand: p.brand ?? "",
    medidas: {
      width: p.measures.width != null ? String(p.measures.width) : "",
      length: p.measures.length != null ? String(p.measures.length) : "",
      height: p.measures.height != null ? String(p.measures.height) : "",
      weight: p.measures.weight != null ? String(p.measures.weight) : "",
    },
    atributos: Object.fromEntries((fal?.sent.attributes ?? []).map((a: any) => [a.name, a.value ?? ""])),
    atributosMeli: Object.fromEntries((meli?.sent.attributes ?? []).map((a: any) => [a.id, a.value ?? ""])),
    precios: Object.fromEntries((hoja.prices ?? []).map((x) => [x.connectionId, {
      price: x.own.price != null ? String(x.own.price) : "",
      salePrice: x.own.salePrice != null ? String(x.own.salePrice) : "",
      saleStart: x.own.saleStart ? String(x.own.saleStart).slice(0, 10) : "",
      saleEnd: x.own.saleEnd ? String(x.own.saleEnd).slice(0, 10) : "",
    }])),
  };
}

const dinero = (n: number | null | undefined) => (n === null || n === undefined ? "—" : Number(n).toFixed(2));

/** Precio y descuento por cuenta: lo que se envía, de dónde sale y lo que el canal muestra hoy. */
function PrecioDeCanal({ precio, valor, onChange }: { precio: SheetPrice; valor: PrecioPropio; onChange: (v: PrecioPropio) => void }) {
  const s = precio.sent;
  const set = (k: keyof PrecioPropio, v: string) => onChange({ ...valor, [k]: v });
  const desfase = precio.channel.price != null && Math.abs(precio.channel.price - s.price) > 0.009;
  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{NOMBRE_CANAL[precio.marketplace] ?? precio.marketplace}</span>
        <span className="text-xs text-muted-foreground">{precio.account}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-secondary/40 p-2">
          <p className="text-muted-foreground">Se envía</p>
          <p className="text-sm font-medium">{dinero(s.price)}{s.salePrice != null && <span className="text-green-500"> · desc. {dinero(s.salePrice)}</span>}</p>
          <p className="text-[11px] text-muted-foreground">Precio: {ORIGEN_PRECIO[s.origin.price]}{s.origin.promo ? ` · descuento: ${ORIGEN_PRECIO[s.origin.promo]}` : ""}</p>
        </div>
        <div className="rounded-md bg-secondary/40 p-2">
          <p className="text-muted-foreground">El canal muestra hoy</p>
          <p className="text-sm font-medium">{dinero(precio.channel.price)}{precio.channel.salePrice != null && <span className="text-green-500"> · desc. {dinero(precio.channel.salePrice)}</span>}</p>
          {desfase && <p className="text-[11px] text-amber-500">Distinto de lo que se envía: se corrige al guardar.</p>}
        </div>
        <div className="rounded-md bg-secondary/40 p-2">
          <p className="text-muted-foreground">Del producto</p>
          <p className="text-sm font-medium">{dinero(precio.productPrice)}{precio.productSalePrice != null && <span className="text-green-500"> · desc. {dinero(precio.productSalePrice)}</span>}</p>
          <p className="text-[11px] text-muted-foreground">Stock en Synkro: {precio.stock}{precio.channel.stock != null ? ` · en el canal: ${precio.channel.stock}` : ""}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] font-normal text-muted-foreground">Precio solo en este canal</Label>
          <Input type="number" min="0" step="0.01" value={valor.price} placeholder={precio.productPrice != null ? String(precio.productPrice) : ""} onChange={(e) => set("price", e.target.value)} />
        </div>
        {precio.canSetSale && (
          <>
            <div className="space-y-1">
              <Label className="text-[11px] font-normal text-muted-foreground">Precio con descuento</Label>
              <Input type="number" min="0" step="0.01" value={valor.salePrice} placeholder={precio.productSalePrice != null ? String(precio.productSalePrice) : "Sin descuento"} onChange={(e) => set("salePrice", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-normal text-muted-foreground">Descuento desde</Label>
              <Input type="date" value={valor.saleStart} onChange={(e) => set("saleStart", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-normal text-muted-foreground">Descuento hasta</Label>
              <Input type="date" value={valor.saleEnd} onChange={(e) => set("saleEnd", e.target.value)} />
            </div>
          </>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {precio.canSetSale
          ? "Déjalos vacíos para usar los del producto. Quitar un descuento ya enviado se hace desde el Seller Center de Falabella."
          : "Déjalo vacío para usar el precio del producto. Los descuentos de Mercado Libre se manejan en su propia herramienta de promociones."}
      </p>
    </div>
  );
}

function EstadoDelCanal({ canal }: { canal: SheetChannel }) {
  const e = ESTADO[canal.status] ?? ESTADO.paused;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge className={cn("text-[10px]", e.clase)}>{e.texto}</Badge>
      <span className="text-muted-foreground">{canal.account}</span>
      {canal.permalink && (
        <a href={canal.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
          Ver publicación <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

type Origen = "ia" | "canal" | null | undefined;

/**
 * Una etiqueta pequeña que dice de dónde salió un dato: lo escribió la IA (conviene revisarlo) o lo trajo el canal al importar.
 * Un dato sin etiqueta lo puso una persona. Al editar un dato y guardar, la etiqueta desaparece.
 */
function EtiquetaDeOrigen({ origen }: { origen: Origen }) {
  if (!origen) return null;
  const esIA = origen === "ia";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("ml-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium align-middle cursor-default", esIA ? "bg-violet-500/15 text-violet-400" : "bg-sky-500/15 text-sky-400")}>
          {esIA ? <Sparkles className="w-2.5 h-2.5" /> : <Download className="w-2.5 h-2.5" />}
          {esIA ? "IA" : "Canal"}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px] text-xs">
        {esIA ? "Generado con IA. Revísalo antes de enviarlo; si lo editas y guardas, deja de marcarse." : "Importado del canal tal como lo tenía. Si lo editas y guardas, deja de marcarse."}
      </TooltipContent>
    </Tooltip>
  );
}

function CampoDeAtributo({
  etiqueta, descripcion, obligatorio, opciones, valor, onChange, origen, propio,
}: { etiqueta: string; descripcion?: string; obligatorio?: boolean; opciones?: string[]; valor: string; onChange: (v: string) => void; origen?: Origen; propio?: boolean }) {
  if (propio) {
    return (
      <div className="space-y-1 min-w-0 opacity-70">
        <Label className="text-xs">{etiqueta}</Label>
        <Input value={valor} disabled />
        <p className="text-[11px] text-muted-foreground">Propio de cada variante: se edita en cada una.</p>
      </div>
    );
  }
  return (
    <div className="space-y-1 min-w-0">
      <Label className="text-xs">
        {etiqueta}
        <EtiquetaDeOrigen origen={origen} />
        {obligatorio !== undefined && (
          <span className={cn("ml-1 text-[10px] font-normal", obligatorio ? "text-destructive" : "text-muted-foreground")}>
            {obligatorio ? "obligatorio" : "sube la calidad"}
          </span>
        )}
      </Label>
      {descripcion && <p className="text-[11px] text-muted-foreground break-words line-clamp-2" title={descripcion}>{descripcion}</p>}
      {opciones && opciones.length > 0 ? (
        <Select value={valor || undefined} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Sin completar" /></SelectTrigger>
          <SelectContent className="max-h-60">
            {opciones.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input value={valor} onChange={(e) => onChange(e.target.value)} placeholder="Sin completar" />
      )}
    </div>
  );
}

/**
 * Desde la fila de un grupo la ficha se abre con todas sus variantes a la vista: se elige cuál se está viendo y, al guardar,
 * los cambios van a esa variante. Un producto simple se muestra como siempre.
 */
const TODAS = "__todas__";

const CANALES_DE_PUBLICACION = ["falabella", "ripley", "mercadolibre"];

interface AccionesDeCanal { onPublicar?: () => void; onPrepararFalabella?: () => void; onPrepararRipley?: () => void }

/** Pestaña «Canales»: una tarjeta por cuenta conectada (solo las conectadas) con su estado y sus acciones. */
function CanalesDelProducto({ hoja, acciones, onVer, modoGrupo }: { hoja: SheetData; acciones: AccionesDeCanal; onVer: (canal: string) => void; modoGrupo: boolean }) {
  const { can } = useStores();
  const { data, isLoading } = useQuery({ queryKey: ["sync-connections"], queryFn: () => syncApi.getConnections(), staleTime: 30_000 });
  const conectadas = (data?.data ?? []).filter((c) => c.status === "active" && CANALES_DE_PUBLICACION.includes(c.marketplace));
  const sinConectar = CANALES_DE_PUBLICACION.filter((m) => !conectadas.some((c) => c.marketplace === m));
  const puede = can("canales.publicar");
  if (isLoading) return <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>;
  return (
    <div className="space-y-3">
      {conectadas.length === 0 && <p className="text-sm text-muted-foreground">Esta tienda todavía no tiene canales conectados. Conéctalos en Marketplaces para publicar desde aquí.</p>}
      {conectadas.map((c) => {
        const ficha = hoja.channels.find((x) => x.connectionId === c.id);
        const estado = ficha ? ESTADO[ficha.status] ?? ESTADO.paused : null;
        const publicado = ficha?.status === "published";
        const cuenta = c.label || c.externalNickname || "";
        return (
          <div key={c.id} className="rounded-xl border border-border p-3 flex items-center gap-3 flex-wrap">
            <div className="min-w-[120px]">
              <p className="font-medium text-sm">{NOMBRE_CANAL[c.marketplace] ?? c.marketplace}</p>
              {cuenta && <p className="text-[11px] text-muted-foreground">{cuenta}</p>}
            </div>
            {estado ? <Badge className={cn("text-[10px]", estado.clase)}>{estado.texto}</Badge> : <Badge className="bg-secondary text-muted-foreground text-[10px]">Sin publicar</Badge>}
            <p className="flex-1 min-w-[160px] text-xs text-muted-foreground break-words">
              {ficha?.lastError ? ficha.lastError : ficha ? (ficha.sent?.categoryPath ?? ficha.sent?.categoryId ?? "") : "Todavía no está en este canal."}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ficha?.permalink && <a href={ficha.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="w-3 h-3" />Ver en el canal</a>}
              {ficha && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onVer(c.marketplace)}>Ver ficha</Button>}
              {puede && c.marketplace === "falabella" && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={acciones.onPrepararFalabella}>Preparar</Button>}
              {puede && c.marketplace === "ripley" && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={acciones.onPrepararRipley}>{publicado ? "Revisar" : "Preparar"}</Button>}
              {puede && !publicado && c.marketplace !== "ripley" && <Button size="sm" className="h-8 text-xs" onClick={acciones.onPublicar}><Rocket className="w-3.5 h-3.5 mr-1" />Publicar</Button>}
            </div>
          </div>
        );
      })}
      {sinConectar.map((m) => (
        <div key={m} className="rounded-xl border border-dashed border-border p-3 flex items-center gap-3 flex-wrap text-muted-foreground">
          <p className="font-medium text-sm min-w-[120px]">{NOMBRE_CANAL[m]}</p>
          <Badge className="bg-secondary text-muted-foreground text-[10px]"><Plug className="w-3 h-3 mr-1" />No conectado</Badge>
          <p className="text-xs flex-1">Conéctalo en Marketplaces para publicar aquí.</p>
        </div>
      ))}
      {modoGrupo && <p className="text-[11px] text-muted-foreground">Estás viendo todas las variantes juntas: lo que publiques o prepares aquí vale para todas.</p>}
    </div>
  );
}

/** Precio y stock de Synkro frente a los de cada canal, con un botón para sincronizar cuando difieren. */
function SincronizarCanales({ filas, onHecho }: { filas: SheetSync[]; onHecho: () => void }) {
  const { can } = useStores();
  const puede = can("canales.publicar");
  const enviar = useMutation({
    mutationFn: async (f: SheetSync) => {
      const difierePrecio = f.price.channel == null || f.price.synkro !== f.price.channel;
      const difiereStock = f.stock.channel == null || f.stock.synkro !== f.stock.channel;
      const mensajes: string[] = [];
      if (difierePrecio) { const r = await syncApi.resendListingPrice(f.listingId); if (r.error) throw new Error(r.error); mensajes.push(r.data?.message ?? "Precio enviado"); }
      if (difiereStock) { const r = await syncApi.resendListingStock(f.listingId); if (r.error) throw new Error(r.error); mensajes.push(r.data?.message ?? "Stock enviado"); }
      return mensajes;
    },
    onSuccess: (m, f) => { toast.success(`${NOMBRE_CANAL[f.marketplace] ?? f.marketplace}: ${m.join(" · ") || "ya estaba al día"}`); onHecho(); },
    onError: (e: Error) => toast.error(e.message || "No se pudo sincronizar"),
  });
  const diferenteStock = (f: SheetSync) => f.stock.channel != null && f.stock.synkro !== f.stock.channel;
  if (!filas.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Lo que Synkro tiene y lo que cada canal muestra. Si no coinciden, sincroniza para enviar el valor de Synkro.</p>
      {filas.map((f) => {
        const pDif = f.price.channel != null && f.price.synkro !== f.price.channel;
        const sDif = diferenteStock(f);
        const alDia = !pDif && !sDif && f.price.channel != null && f.stock.channel != null;
        return (
          <div key={f.listingId} className="rounded-xl border border-border p-3 flex items-center gap-3 flex-wrap text-sm">
            <div className="min-w-[120px]"><p className="font-medium">{NOMBRE_CANAL[f.marketplace] ?? f.marketplace}</p><p className="text-[11px] text-muted-foreground">{f.account}</p></div>
            <div className="min-w-[150px]"><p className="text-[11px] text-muted-foreground">Precio</p><p className={cn(pDif && "text-amber-500")}>Synkro S/ {dinero(f.price.synkro)} · canal S/ {dinero(f.price.channel)}</p></div>
            <div className="min-w-[130px]"><p className="text-[11px] text-muted-foreground">Stock</p><p className={cn(sDif && "text-amber-500")}>Synkro {f.stock.synkro} · canal {f.stock.channel ?? "—"}</p></div>
            <div className="flex-1 flex justify-end items-center gap-2">
              {alDia ? <Badge className="bg-green-500/10 text-green-500 text-[10px]">Al día</Badge> : null}
              {puede && (
                <Button size="sm" variant={alDia ? "ghost" : "outline"} className="h-8 text-xs" onClick={() => enviar.mutate(f)} disabled={enviar.isPending}>
                  {enviar.isPending && enviar.variables?.listingId === f.listingId ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                  Sincronizar
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface ProductSheetDialogProps {
  product: Product | null;
  onClose: () => void;
  onPublish?: (p: Product) => void;
  onPrepareFalabella?: (p: Product) => void;
  onPrepareRipley?: (p: Product) => void;
}

export function ProductSheetDialog({ product, onClose, onPublish, onPrepareFalabella, onPrepareRipley }: ProductSheetDialogProps) {
  const [elegida, setElegida] = useState<string | null>(null);
  const grupoId = product?.alGrupo ? product.group?.id : undefined;
  useEffect(() => setElegida(null), [product?.id, product?.alGrupo]);
  const { data } = useQuery({
    queryKey: ["products", "grupo", { groupId: grupoId }],
    queryFn: () => productsApi.findAll({ groupId: grupoId, limit: 100, sortBy: "createdAt", order: "asc" }),
    enabled: !!grupoId,
    staleTime: 30_000,
  });
  const variantes = grupoId ? data?.data?.data ?? [] : [];
  // Con varias variantes la ficha se abre en «Todas»: lo común se edita una sola vez y se aplica a todas.
  const todas = variantes.length > 1 && (elegida === null || elegida === TODAS);
  const actual = product && variantes.length ? (todas ? variantes[0] : variantes.find((v) => v.id === elegida) ?? variantes[0]) : product;
  const grupo = product?.group;
  const alAbrir = (f?: (p: Product) => void) => (f && product ? () => { onClose(); f(product); } : undefined);
  return (
    <FichaDeProducto
      acciones={{ onPublicar: alAbrir(onPublish), onPrepararFalabella: alAbrir(onPrepareFalabella), onPrepararRipley: alAbrir(onPrepareRipley) }}
      product={actual}
      onClose={onClose}
      variantes={variantes}
      variantId={todas ? TODAS : actual?.id}
      onElegir={setElegida}
      modoGrupo={todas && !!grupoId}
      grupoId={grupoId}
      nombreDelGrupo={grupo?.name}
      ejes={(grupo?.axes ?? []).map((e: { name: string }) => e.name)}
    />
  );
}

function FichaDeProducto({
  product, onClose, variantes = [], variantId, onElegir, modoGrupo = false, grupoId, nombreDelGrupo, ejes = [], acciones = {},
}: {
  acciones?: AccionesDeCanal; product: Product | null; onClose: () => void; variantes?: Product[]; variantId?: string; onElegir?: (id: string) => void;
  modoGrupo?: boolean; grupoId?: string; nombreDelGrupo?: string; ejes?: string[];
}) {
  const queryClient = useQueryClient();
  const open = product !== null;
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [verHtml, setVerHtml] = useState(true);
  const [pestana, setPestana] = useState("canales");
  useEffect(() => { if (product !== null) setPestana("canales"); }, [product === null]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["product-sheet", product?.id],
    queryFn: () => syncApi.getProductSheet(product!.id),
    enabled: open,
    staleTime: 0,
  });
  const hoja = data?.data ?? null;
  const original = useMemo(() => (hoja ? borradorDe(hoja, modoGrupo ? nombreDelGrupo : undefined) : null), [hoja, modoGrupo, nombreDelGrupo]);

  useEffect(() => {
    if (original) setBorrador(original);
  }, [original]);

  const cambia = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setBorrador((b) => (b ? { ...b, [k]: v } : b));

  // Solo se envía lo que cambió: así un guardado no pisa lo que no se tocó.
  const cambios = useMemo(() => {
    if (!borrador || !original) return null;
    const c: Record<string, any> = {};
    // En el modo «todas las variantes» el nombre interno y los precios son de cada variante: no se mandan.
    (["name", "aiTitle", "aiDescription", "descriptionHtml", "brand"] as const).forEach((k) => {
      if (modoGrupo && k === "name") return;
      if (borrador[k] !== original[k]) c[k] = borrador[k];
    });
    const a: Record<string, string> = {};
    for (const [k, v] of Object.entries(borrador.atributos)) if (v !== (original.atributos[k] ?? "") && !(modoGrupo && esPropioDeVariante(k, ejes))) a[k] = v;
    if (Object.keys(a).length) c.attributes = a;
    const m: Record<string, string> = {};
    for (const [k, v] of Object.entries(borrador.atributosMeli)) if (v !== (original.atributosMeli[k] ?? "") && !(modoGrupo && esPropioDeVariante(k, ejes))) m[k] = v;
    if (Object.keys(m).length) c.mercadolibreAttributes = m;
    const med = borrador.medidas;
    if (JSON.stringify(med) !== JSON.stringify(original.medidas) && [med.width, med.length, med.height, med.weight].every((x) => Number(x) > 0)) {
      c.measures = { width: Number(med.width), length: Number(med.length), height: Number(med.height), weight: Number(med.weight) };
    }
    // Precios: se envía el estado completo de cada cuenta cuyo precio o descuento cambió.
    const numero = (v: string) => (v.trim() === "" ? null : Number(v));
    const p = modoGrupo ? [] : Object.entries(borrador.precios)
      .filter(([id, v]) => JSON.stringify(v) !== JSON.stringify(original.precios[id]))
      .map(([id, v]) => ({ connectionId: id, price: numero(v.price), salePrice: numero(v.salePrice), saleStart: v.saleStart || null, saleEnd: v.saleEnd || null }));
    if (p.length) c.prices = p;
    return Object.keys(c).length ? c : null;
  }, [borrador, original, modoGrupo, ejes]);

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: modoGrupo ? ["product-sheet"] : ["product-sheet", product?.id] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
  };

  const guardar = useMutation({
    mutationFn: () => (modoGrupo && grupoId ? syncApi.saveGroupSheet(grupoId, cambios!) : syncApi.saveProductSheet(product!.id, cambios!)),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo guardar");
      const data = res.data as { willUpdate: string[]; pricesSent?: string[]; variantes?: number };
      const destinos = data.willUpdate.map((m) => NOMBRE_CANAL[m] ?? m);
      const precios = (data.pricesSent ?? []).map((m) => NOMBRE_CANAL[m] ?? m);
      if (modoGrupo) {
        toast.success(
          destinos.length
            ? `Guardado en ${data.variantes ?? "todas las"} variantes. Se enviará a ${destinos.join(" y ")} de a una, en unos minutos.`
            : `Guardado en ${data.variantes ?? "todas las"} variantes. Todavía no están publicadas en ningún canal, así que no hay nada que enviar.`,
        );
      } else {
        toast.success(
          destinos.length
            ? `Guardado. Se enviará solo a ${destinos.join(" y ")} en menos de un minuto.`
            : precios.length
              ? `Guardado. Los precios se enviarán a ${precios.join(" y ")} en unos minutos.`
              : "Guardado. Este producto aún no está publicado en ningún canal, así que no hay nada que enviar.",
        );
      }
      refrescar();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const enviarYa = useMutation({
    mutationFn: () => syncApi.syncProductSheetNow(product!.id),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo enviar");
      if (!res.data.results.length) return toast.info("No hay canales publicados donde enviar.");
      res.data.results.forEach((r) => (r.ok ? toast.success(`${NOMBRE_CANAL[r.marketplace] ?? r.marketplace}: ${r.message}`) : toast.error(`${NOMBRE_CANAL[r.marketplace] ?? r.marketplace}: ${r.message}`)));
      refrescar();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const fal = hoja?.channels.find((c) => c.marketplace === "falabella");
  const meli = hoja?.channels.find((c) => c.marketplace === "mercadolibre");
  const ripley = hoja?.channels.find((c) => c.marketplace === "ripley");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[860px] max-h-[92vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> {modoGrupo ? "Ficha del grupo" : "Ficha del producto"}</DialogTitle>
          <DialogDescription className="break-words">
            {modoGrupo
              ? `${nombreDelGrupo ?? product?.name} · ${variantes.length} variantes. Lo que cambies aquí se aplica a todas.`
              : `${hoja ? `${hoja.product.name} · SKU ${hoja.product.sku}` : product?.name}. Esto es lo que se envía a cada canal; al guardar, los cambios se envían solos a donde está publicado.`}
          </DialogDescription>
        </DialogHeader>

        {hoja?.product.importedFrom && (
          <p className="text-xs text-muted-foreground">
            Producto importado desde {NOMBRE_CANAL[hoja.product.importedFrom] ?? hoja.product.importedFrom}.
          </p>
        )}

        {variantes.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <span className="text-xs text-muted-foreground mr-1 shrink-0">Variante:</span>
            <button type="button" onClick={() => onElegir?.(TODAS)} className={`shrink-0 whitespace-nowrap text-xs rounded-full border px-2.5 py-1 font-medium transition-colors ${variantId === TODAS ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"}`}>
              Todas las variantes ({variantes.length})
            </button>
            {variantes.map((v) => (
              <button key={v.id} type="button" onClick={() => onElegir?.(v.id)} className={`shrink-0 whitespace-nowrap text-xs rounded-full border px-2.5 py-1 transition-colors ${v.id === variantId ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                {v.variantValues ? Object.values(v.variantValues).join(" / ") : v.sku} <span className="font-mono opacity-70">{v.sku}</span>
              </button>
            ))}
          </div>
        )}

        {modoGrupo && (
          <p className="text-xs rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-muted-foreground">
            <span className="font-medium text-foreground">Editas lo común de las {variantes.length} variantes.</span> Se aplica solo lo que cambies, y cada variante conserva el resto.
            Lo propio de cada una (nombre interno, precio, color, talla, fotos, stock) se edita eligiéndola arriba.
          </p>
        )}

        {isLoading || !borrador ? (
          <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>
        ) : isError || !hoja ? (
          <p className="text-sm text-destructive">No se pudo cargar la ficha.</p>
        ) : (
          <Tabs value={pestana} onValueChange={setPestana}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="canales">Canales</TabsTrigger>
              <TabsTrigger value="general">Contenido</TabsTrigger>
              {((((hoja.prices.length > 0) || ((hoja.sync ?? []).length > 0)) && !modoGrupo) || (modoGrupo && grupoId)) && <TabsTrigger value="precios">Precios y stock</TabsTrigger>}
              {fal && <TabsTrigger value="falabella">Falabella</TabsTrigger>}
              {meli && <TabsTrigger value="mercadolibre">Mercado Libre</TabsTrigger>}
              {ripley && <TabsTrigger value="ripley">Ripley</TabsTrigger>}
            </TabsList>

            {hoja.channels.length === 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Este producto todavía no está publicado en Falabella ni en Mercado Libre. Puedes editar su ficha; cuando lo publiques se enviará con estos datos.
              </p>
            )}

            {/* ── Canales ── */}
            <TabsContent value="canales" className="pt-4">
              <CanalesDelProducto hoja={hoja} acciones={acciones} onVer={setPestana} modoGrupo={modoGrupo} />
            </TabsContent>

            {/* ── General ── */}
            <TabsContent value="general" className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">{modoGrupo ? "Título común del grupo (sin color ni talla)" : "Título que se envía a los canales"}{!modoGrupo && <EtiquetaDeOrigen origen={hoja.product.origin?.aiTitle} />}</Label>
                  <Input value={borrador.aiTitle} onChange={(e) => cambia("aiTitle", e.target.value)} placeholder={borrador.name} />
                  <p className="text-[11px] text-muted-foreground">
                    {borrador.aiTitle.length || borrador.name.length} caracteres. Falabella pide entre 20 y 100; Mercado Libre recorta a 60. Si lo dejas vacío se usa el nombre.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nombre del producto (interno)</Label>
                  <Input value={borrador.name} onChange={(e) => cambia("name", e.target.value)} disabled={modoGrupo} />
                  {modoGrupo && <p className="text-[11px] text-muted-foreground">Cada variante lleva el suyo («… - Beige · 36»): se edita en cada una.</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Marca<EtiquetaDeOrigen origen={hoja.product.origin?.brand} /></Label>
                  <Input value={borrador.brand} onChange={(e) => cambia("brand", e.target.value)} placeholder="GENERICO" />
                  <p className="text-[11px] text-muted-foreground">En Falabella solo vale una marca de su catálogo (se cambia desde Publicar).</p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Descripción en texto (Mercado Libre y canales sin HTML)<EtiquetaDeOrigen origen={hoja.product.origin?.aiDescription} /></Label>
                <Textarea rows={5} value={borrador.aiDescription} onChange={(e) => cambia("aiDescription", e.target.value)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Descripción HTML (Falabella y canales con HTML)<EtiquetaDeOrigen origen={hoja.product.origin?.descriptionHtml} /></Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setVerHtml((v) => !v)}>{verHtml ? "Ver código" : "Ver vista previa"}</Button>
                </div>
                {verHtml && borrador.descriptionHtml ? (
                  <iframe title="Vista previa" sandbox="" srcDoc={borrador.descriptionHtml} className="w-full h-96 rounded-lg border border-border bg-white" />
                ) : (
                  <Textarea rows={10} className="font-mono text-xs" value={borrador.descriptionHtml} onChange={(e) => cambia("descriptionHtml", e.target.value)} placeholder="Sin descripción HTML: se envía el texto." />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Medidas del paquete (Falabella calcula el envío con ellas)</Label>
                {hoja.product.measures.estimated && (
                  <Badge className="bg-amber-500/15 text-amber-500 text-[10px]">Estimadas por la IA: revísalas</Badge>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([["width", "Ancho (cm)"], ["length", "Largo (cm)"], ["height", "Alto (cm)"], ["weight", "Peso (kg)"]] as const).map(([k, et]) => (
                    <div key={k} className="space-y-1">
                      <Label className="text-[11px] font-normal text-muted-foreground">{et}</Label>
                      <Input type="number" min="0" step={k === "weight" ? "0.01" : "1"} value={borrador.medidas[k]} onChange={(e) => cambia("medidas", { ...borrador.medidas, [k]: e.target.value })} />
                    </div>
                  ))}
                </div>
              </div>

              {hoja.product.images.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Fotos</Label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {hoja.product.images.map((u) => <img key={u} src={u} alt="" className="h-20 w-20 object-cover rounded-lg border border-border shrink-0" />)}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Precios de todas las variantes ── */}
            {modoGrupo && grupoId && (
              <TabsContent value="precios" className="pt-4">
                <GroupPriceForm groupId={grupoId} />
              </TabsContent>
            )}

            {/* ── Precios por canal ── */}
            {(hoja.prices.length > 0 || (hoja.sync ?? []).length > 0) && !modoGrupo && (
              <TabsContent value="precios" className="pt-4 space-y-4">
                <SincronizarCanales filas={hoja.sync ?? []} onHecho={refrescar} />
                {hoja.prices.length > 0 && <p className="text-xs text-muted-foreground">
                  Cada canal usa el precio del producto salvo que fijes uno propio aquí. Actualizar el contenido con la IA nunca quita un descuento: se conserva el que el canal ya tiene.
                </p>}
                {hoja.prices.map((x) => (
                  <PrecioDeCanal
                    key={x.connectionId}
                    precio={x}
                    valor={borrador.precios[x.connectionId] ?? { price: "", salePrice: "", saleStart: "", saleEnd: "" }}
                    onChange={(v) => cambia("precios", { ...borrador.precios, [x.connectionId]: v })}
                  />
                ))}
              </TabsContent>
            )}

            {/* ── Falabella ── */}
            {fal && (
              <TabsContent value="falabella" className="pt-4 space-y-4">
                <EstadoDelCanal canal={fal} />
                {fal.lastError && <p className="text-xs text-red-400 break-words flex gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{fal.lastError}</p>}
                {fal.listo ? (
                  <p className="text-xs text-green-500 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> La ficha cumple lo que pide Falabella.</p>
                ) : (
                  <p className="text-xs text-amber-500 break-words flex gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />Todavía {fal.motivo}.</p>
                )}
                <div className="rounded-lg border border-border p-3 space-y-1 text-sm break-words">
                  <p><span className="text-muted-foreground">Nombre que se envía:</span> {fal.sent.name}</p>
                  <p><span className="text-muted-foreground">Categoría:</span> {fal.sent.categoryPath ?? fal.sent.categoryId ?? "sin asignar"}</p>
                  {fal.sent.categoryReview && (
                    <p className="text-xs text-amber-500 flex gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>Revisa la categoría: {String(fal.sent.categoryReview)}. Si es correcta, ignora este aviso; para cambiarla usa Publicar → Preparar para Falabella.</span>
                    </p>
                  )}
                  <p><span className="text-muted-foreground">Marca:</span> {fal.sent.brand}</p>
                  <p><span className="text-muted-foreground">Descripción:</span> {fal.sent.isHtml ? "HTML estándar de la agencia" : "texto plano"}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Atributos de la categoría ({(fal.sent.attributes as any[]).filter((a) => borrador.atributos[a.name]).length} de {(fal.sent.attributes as any[]).length} con valor)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(fal.sent.attributes as any[]).map((a) => (
                      <CampoDeAtributo
                        key={a.name}
                        etiqueta={a.label}
                        descripcion={a.description}
                        obligatorio={a.required}
                        origen={a.origin}
                        opciones={a.options}
                        valor={borrador.atributos[a.name] ?? ""}
                        propio={modoGrupo && (esPropioDeVariante(a.name, ejes) || esPropioDeVariante(a.label ?? "", ejes))}
                        onChange={(v) => cambia("atributos", { ...borrador.atributos, [a.name]: v })}
                      />
                    ))}
                  </div>
                </div>
              </TabsContent>
            )}

            {/* ── Mercado Libre ── */}
            {meli && (
              <TabsContent value="mercadolibre" className="pt-4 space-y-4">
                <EstadoDelCanal canal={meli} />
                {meli.lastError && <p className="text-xs text-red-400 break-words flex gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{meli.lastError}</p>}
                <div className="rounded-lg border border-border p-3 space-y-1 text-sm break-words">
                  <p><span className="text-muted-foreground">Título:</span> {meli.sent.title} <span className="text-[11px] text-muted-foreground">(Mercado Libre no deja cambiarlo en una publicación ya creada)</span></p>
                  <p><span className="text-muted-foreground">Categoría:</span> {meli.sent.categoryId ?? "—"}</p>
                </div>
                <p className="text-xs text-muted-foreground">La descripción de texto se edita en la pestaña General. Aquí van los atributos que recibe Mercado Libre:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(meli.sent.attributes as any[]).map((a) => (
                    <CampoDeAtributo key={a.id} etiqueta={a.id} origen={a.origin} propio={modoGrupo && esPropioDeVariante(a.id, ejes)} valor={borrador.atributosMeli[a.id] ?? ""} onChange={(v) => cambia("atributosMeli", { ...borrador.atributosMeli, [a.id]: v })} />
                  ))}
                </div>
              </TabsContent>
            )}

            {/* ── Ripley (solo lectura) ── */}
            {ripley && (
              <TabsContent value="ripley" className="pt-4 space-y-4">
                <EstadoDelCanal canal={ripley} />
                {ripley.lastError && <p className="text-xs text-red-400 break-words flex gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{ripley.lastError}</p>}
                {ripley.listo ? (
                  <p className="text-xs text-green-500 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Esto es lo que Synkro preparó y envió a Ripley.</p>
                ) : (
                  <p className="text-xs text-amber-500 break-words flex gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{ripley.motivo ?? "Todavía falta preparar este producto para Ripley."}</p>
                )}
                <div className="rounded-lg border border-border p-3 space-y-1 text-sm break-words">
                  <p><span className="text-muted-foreground">Nombre que se envió:</span> {ripley.sent.name ?? "—"}</p>
                  {ripley.sent.shortDescription && <p><span className="text-muted-foreground">Descripción corta:</span> {ripley.sent.shortDescription}</p>}
                  <p><span className="text-muted-foreground">Categoría:</span> {ripley.sent.categoryPath ?? ripley.sent.categoryId ?? "sin asignar"}</p>
                  <p><span className="text-muted-foreground">Marca:</span> {ripley.sent.brand ?? "—"}</p>
                  <p><span className="text-muted-foreground">Descripción:</span> {ripley.sent.description ? (ripley.sent.isHtml ? "HTML estándar de la agencia" : "texto plano") : "—"}</p>
                  <p><span className="text-muted-foreground">Oferta en Ripley:</span> {ripley.sent.offerId ?? "—"}{ripley.sent.channelPrice != null ? ` · S/ ${ripley.sent.channelPrice}` : ""}{ripley.sent.channelStock != null ? ` · stock ${ripley.sent.channelStock}` : ""}</p>
                </div>
                {(ripley.sent.attributes as any[]).length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">Atributos de la categoría que se enviaron ({(ripley.sent.attributes as any[]).length})</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(ripley.sent.attributes as any[]).map((a) => (
                        <div key={a.name} className="rounded-lg border border-border px-3 py-2 text-sm break-words">
                          <p className="text-[11px] text-muted-foreground">{a.label}{a.required ? " · obligatorio" : ""}</p>
                          <p>{a.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Por ahora esta pestaña es solo de lectura. Para cambiar la categoría, los atributos o la marca usa Publicar → Preparar para Ripley. El stock y el precio de Ripley se sincronizan solos.
                </p>
              </TabsContent>
            )}
          </Tabs>
        )}

        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          {!modoGrupo && (
            <Button variant="outline" onClick={() => enviarYa.mutate()} disabled={enviarYa.isPending || !hoja || hoja.channels.filter((c) => c.marketplace !== "ripley").length === 0 || cambios !== null} title={cambios ? "Guarda primero los cambios" : "Envía ya, sin esperar"}>
              {enviarYa.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
              Enviar ahora a los canales
            </Button>
          )}
          <Button onClick={() => guardar.mutate()} disabled={!cambios || guardar.isPending}>
            {guardar.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {modoGrupo ? `Guardar en las ${variantes.length} variantes` : "Guardar y enviar a los canales"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
