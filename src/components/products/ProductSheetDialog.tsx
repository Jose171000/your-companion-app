import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, ExternalLink, FileText, Loader2, Rocket, Save } from "lucide-react";
import { Product } from "@/lib/products-api";
import { SheetChannel, SheetData, syncApi } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const NOMBRE_CANAL: Record<string, string> = { falabella: "Falabella", mercadolibre: "Mercado Libre" };

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
}

function borradorDe(hoja: SheetData): Borrador {
  const fal = hoja.channels.find((c) => c.marketplace === "falabella");
  const meli = hoja.channels.find((c) => c.marketplace === "mercadolibre");
  const p = hoja.product;
  return {
    name: p.name,
    aiTitle: p.aiTitle ?? "",
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
  };
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

function CampoDeAtributo({
  etiqueta, descripcion, obligatorio, opciones, valor, onChange,
}: { etiqueta: string; descripcion?: string; obligatorio?: boolean; opciones?: string[]; valor: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1 min-w-0">
      <Label className="text-xs">
        {etiqueta}
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

export function ProductSheetDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const open = product !== null;
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [verHtml, setVerHtml] = useState(true);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["product-sheet", product?.id],
    queryFn: () => syncApi.getProductSheet(product!.id),
    enabled: open,
    staleTime: 0,
  });
  const hoja = data?.data ?? null;
  const original = useMemo(() => (hoja ? borradorDe(hoja) : null), [hoja]);

  useEffect(() => {
    if (original) setBorrador(original);
  }, [original]);

  const cambia = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setBorrador((b) => (b ? { ...b, [k]: v } : b));

  // Solo se envía lo que cambió: así un guardado no pisa lo que no se tocó.
  const cambios = useMemo(() => {
    if (!borrador || !original) return null;
    const c: Record<string, any> = {};
    (["name", "aiTitle", "aiDescription", "descriptionHtml", "brand"] as const).forEach((k) => {
      if (borrador[k] !== original[k]) c[k] = borrador[k];
    });
    const a: Record<string, string> = {};
    for (const [k, v] of Object.entries(borrador.atributos)) if (v !== (original.atributos[k] ?? "")) a[k] = v;
    if (Object.keys(a).length) c.attributes = a;
    const m: Record<string, string> = {};
    for (const [k, v] of Object.entries(borrador.atributosMeli)) if (v !== (original.atributosMeli[k] ?? "")) m[k] = v;
    if (Object.keys(m).length) c.mercadolibreAttributes = m;
    const med = borrador.medidas;
    if (JSON.stringify(med) !== JSON.stringify(original.medidas) && [med.width, med.length, med.height, med.weight].every((x) => Number(x) > 0)) {
      c.measures = { width: Number(med.width), length: Number(med.length), height: Number(med.height), weight: Number(med.weight) };
    }
    return Object.keys(c).length ? c : null;
  }, [borrador, original]);

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ["product-sheet", product?.id] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
  };

  const guardar = useMutation({
    mutationFn: () => syncApi.saveProductSheet(product!.id, cambios!),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo guardar");
      const destinos = res.data.willUpdate.map((m) => NOMBRE_CANAL[m] ?? m);
      toast.success(
        destinos.length
          ? `Guardado. Se enviará solo a ${destinos.join(" y ")} en menos de un minuto.`
          : "Guardado. Este producto aún no está publicado en ningún canal, así que no hay nada que enviar.",
      );
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[860px] max-h-[92vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Ficha del producto</DialogTitle>
          <DialogDescription className="break-words">
            {hoja ? `${hoja.product.name} · SKU ${hoja.product.sku}` : product?.name}. Esto es lo que se envía a cada canal; al guardar, los cambios se envían solos a donde está publicado.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !borrador ? (
          <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>
        ) : isError || !hoja ? (
          <p className="text-sm text-destructive">No se pudo cargar la ficha.</p>
        ) : (
          <Tabs defaultValue="general">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="general">General</TabsTrigger>
              {fal && <TabsTrigger value="falabella">Falabella</TabsTrigger>}
              {meli && <TabsTrigger value="mercadolibre">Mercado Libre</TabsTrigger>}
            </TabsList>

            {hoja.channels.length === 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Este producto todavía no está publicado en Falabella ni en Mercado Libre. Puedes editar su ficha; cuando lo publiques se enviará con estos datos.
              </p>
            )}

            {/* ── General ── */}
            <TabsContent value="general" className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Título que se envía a los canales</Label>
                  <Input value={borrador.aiTitle} onChange={(e) => cambia("aiTitle", e.target.value)} placeholder={borrador.name} />
                  <p className="text-[11px] text-muted-foreground">
                    {borrador.aiTitle.length || borrador.name.length} caracteres. Falabella pide entre 20 y 100; Mercado Libre recorta a 60. Si lo dejas vacío se usa el nombre.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nombre del producto (interno)</Label>
                  <Input value={borrador.name} onChange={(e) => cambia("name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Marca</Label>
                  <Input value={borrador.brand} onChange={(e) => cambia("brand", e.target.value)} placeholder="GENERICO" />
                  <p className="text-[11px] text-muted-foreground">En Falabella solo vale una marca de su catálogo (se cambia desde Publicar).</p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Descripción en texto (Mercado Libre y canales sin HTML)</Label>
                <Textarea rows={5} value={borrador.aiDescription} onChange={(e) => cambia("aiDescription", e.target.value)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Descripción HTML (Falabella y canales con HTML)</Label>
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
                        opciones={a.options}
                        valor={borrador.atributos[a.name] ?? ""}
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
                    <CampoDeAtributo key={a.id} etiqueta={a.id} valor={borrador.atributosMeli[a.id] ?? ""} onChange={(v) => cambia("atributosMeli", { ...borrador.atributosMeli, [a.id]: v })} />
                  ))}
                </div>
              </TabsContent>
            )}
          </Tabs>
        )}

        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button variant="outline" onClick={() => enviarYa.mutate()} disabled={enviarYa.isPending || !hoja || hoja.channels.length === 0 || cambios !== null} title={cambios ? "Guarda primero los cambios" : "Envía ya, sin esperar"}>
            {enviarYa.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
            Enviar ahora a los canales
          </Button>
          <Button onClick={() => guardar.mutate()} disabled={!cambios || guardar.isPending}>
            {guardar.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar y enviar a los canales
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
