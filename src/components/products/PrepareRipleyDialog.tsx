import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { syncApi, RipleyCampo, RipleyPublishPreview } from "@/lib/sync-api";
import { Product, productsApi } from "@/lib/products-api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Check, Loader2, PackageCheck, Search, Send, Sparkles, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RipleyBrandField } from "./RipleyBrandField";
import { VariantCompatNotice } from "./VariantCompatNotice";

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Los productos a los que se aplica lo que se guarde: todas las variantes si se pidió desde la fila de un grupo. */
const idsDe = (p: Product) => (p.alGrupo ? (p.groupSummary?.variantIds ?? [p.id]) : [p.id]);

/** Un campo de Ripley con lista larga (tipo de producto: más de 2.000 valores): se busca por texto y se elige uno. */
function CampoDeListaLarga({ campo, valor, onChange }: { campo: RipleyCampo; valor: string; onChange: (v: string) => void }) {
  const [texto, setTexto] = useState("");
  const diferido = useDebounced(texto);
  const { data, isFetching } = useQuery({
    queryKey: ["ripley-list-values", campo.listCode, diferido],
    queryFn: () => syncApi.searchRipleyListValues(campo.listCode!, diferido),
    enabled: !!campo.listCode && diferido.trim().length >= 2,
    staleTime: 10 * 60_000,
  });
  const resultados = data?.data ?? [];
  return (
    <div className="space-y-1.5 min-w-0">
      {valor ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium break-words min-w-0">{valor}</span>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onChange("")} title="Quitar"><X className="w-3.5 h-3.5" /></Button>
        </div>
      ) : null}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input id={`rp-attr-${campo.name}`} className="pl-9" placeholder="Busca en la lista de Ripley…" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      {diferido.trim().length >= 2 && texto.trim().length >= 2 && (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border/50">
          {isFetching ? (
            <p className="text-xs text-muted-foreground p-3">Buscando…</p>
          ) : resultados.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">Ningún valor de Ripley coincide. Prueba con otra palabra.</p>
          ) : (
            resultados.map((v) => (
              <button key={v} type="button" onClick={() => { onChange(v); setTexto(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/40">
                {v}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Ripley exige una categoría de su catálogo y los atributos propios de esa categoría (con valores de listas cerradas).
 * La IA propone la categoría y rellena lo que se puede deducir; aquí se revisa y se completa lo que falte. Solo guarda en
 * Synkro: no envía nada a Ripley.
 */
export function PrepareRipleyDialog({ product, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [categoria, setCategoria] = useState<{ id: string; path: string } | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [nombre, setNombre] = useState("");
  const [corta, setCorta] = useState("");
  const [marca, setMarca] = useState("GENÉRICO");
  const [busqueda, setBusqueda] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  /** Atributos que la IA estimó (no se pudieron deducir del producto): se marcan para revisarlos. */
  const [estimados, setEstimados] = useState<string[]>([]);
  /** Los vacíos que la IA no pudo deducir. */
  const [sinValor, setSinValor] = useState<string[]>([]);
  const busquedaDiferida = useDebounced(busqueda);
  const esGrupo = !!product?.alGrupo;

  // Al abrir se parte de lo que el producto ya tenga guardado para Ripley; si no tiene nada, la IA lo analiza.
  const analizar = useMutation({
    mutationFn: () => productsApi.prepareRipley(product!.id, false, esGrupo),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "La IA no pudo preparar el producto para Ripley");
      const r = res.data;
      if (r.categoria.id) setCategoria({ id: r.categoria.id, path: r.categoria.ruta ?? r.categoria.id });
      else setAviso(r.categoria.motivo ?? "La IA no encontró una categoría de Ripley que encaje: búscala abajo.");
      // Lo que la persona ya escribió tiene prioridad sobre lo que propone la IA.
      setValores((previos) => ({ ...r.atributos, ...Object.fromEntries(Object.entries(previos).filter(([, v]) => v?.trim())) }));
      setNombre((n) => n || r.contenido.name || "");
      setCorta((c) => c || r.contenido.shortDescription || "");
      if (r.contenido.brand) setMarca((m) => (m && m !== "GENÉRICO" ? m : r.contenido.brand!));
      if (r.categoria.id && r.categoria.confianza === "baja") setAviso(`La IA no está segura de esta categoría${r.categoria.motivo ? ` (${r.categoria.motivo})` : ""}: revísala.`);
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  // «Llenar atributos»: con la categoría ya elegida, completa SOLO los vacíos; nunca cambia la categoría ni pisa lo escrito.
  const rellenar = useMutation({
    mutationFn: () => productsApi.fillRipleyAttributes(product!.id, { categoryId: categoria!.id, actuales: valores, alGrupo: esGrupo }),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "La IA no pudo llenar los atributos");
      const r = res.data;
      // Lo escrito (por la persona o por una pasada anterior) tiene prioridad: solo entra lo que estaba vacío.
      setValores((previos) => ({ ...r.values, ...Object.fromEntries(Object.entries(previos).filter(([, v]) => v?.trim())) }));
      setEstimados((e) => [...new Set([...e, ...r.estimated])]);
      setSinValor(r.sinValor);
      if (r.filled === 0) toast.info(r.sinValor.length ? "La IA no pudo deducir los datos que faltan: complétalos a mano." : "No había atributos vacíos que llenar.");
      else toast.success(`La IA llenó ${r.filled} atributo${r.filled === 1 ? "" : "s"} vacío${r.filled === 1 ? "" : "s"}.`);
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  useEffect(() => {
    if (!open || !product) return;
    setEstimados([]);
    setSinValor([]);
    const ids = (product.marketplaceIds as any) ?? {};
    const attrs = (product.aiAttributes as any) ?? {};
    const guardadaId = ids.ripley_category_id ? String(ids.ripley_category_id) : null;
    setCategoria(guardadaId ? { id: guardadaId, path: ids.ripley_category_path ? String(ids.ripley_category_path) : guardadaId } : null);
    setValores(Object.fromEntries(Object.entries(attrs.ripley_attributes ?? {}).map(([k, v]) => [k, String(v)])));
    setNombre(String(attrs.ripley?.name ?? ""));
    setCorta(String(attrs.ripley?.shortDescription ?? ""));
    setMarca(String(attrs.ripley?.brand ?? "GENÉRICO"));
    setBusqueda("");
    setAviso(null);
    if (!guardadaId) analizar.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  const { data: categorias, isFetching: buscando } = useQuery({
    queryKey: ["ripley-categories", busquedaDiferida],
    queryFn: () => syncApi.searchRipleyCategories(busquedaDiferida),
    enabled: open && busquedaDiferida.trim().length >= 3,
    staleTime: 10 * 60_000,
  });

  const { data: camposResult, isFetching: cargandoCampos } = useQuery({
    queryKey: ["ripley-fields", categoria?.id],
    queryFn: () => syncApi.getRipleyCategoryFields(categoria!.id),
    enabled: open && !!categoria?.id,
    staleTime: 10 * 60_000,
  });
  const info = camposResult?.data;
  // En un grupo, el color y la talla (los campos de variante) se toman de cada variante, no se escriben aquí.
  const campos = useMemo(() => (info?.campos ?? []).filter((c) => !(esGrupo && c.isVariant)), [info, esGrupo]);
  const obligatorios = campos.filter((c) => c.required);
  const otros = campos.filter((c) => !c.required);
  const faltan = obligatorios.filter((c) => !valores[c.name]?.trim());
  const listo = !!categoria && faltan.length === 0;

  const guardarTodo = async () => {
    const atributos = Object.fromEntries(Object.entries(valores).filter(([k, v]) => v?.trim() && campos.some((c) => c.name === k)));
    let ultima: Awaited<ReturnType<typeof syncApi.saveRipleyPreparation>> | null = null;
    for (const id of idsDe(product!)) {
      ultima = await syncApi.saveRipleyPreparation(id, { categoryId: categoria!.id, attributes: atributos, content: { name: nombre, shortDescription: corta } });
      if (ultima.error) break;
    }
    return ultima!;
  };

  const guardar = useMutation({
    mutationFn: guardarTodo,
    onSuccess: (res) => {
      if (res.error) return toast.error(res.error);
      toast.success("Guardado para Ripley. No se envió nada a Ripley todavía.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
    onError: () => toast.error("Error al guardar los datos de Ripley"),
  });

  const poner = (nombreCampo: string, v: string) => setValores((a) => ({ ...a, [nombreCampo]: v }));

  // ── Envío a Ripley: guardar → revisar (vista previa, no envía) → enviar (con confirmación) → seguir la importación ──
  const [vista, setVista] = useState<RipleyPublishPreview | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [envio, setEnvio] = useState<{ importId: string | number; productImportId: string | number | null; enviados: string[] } | null>(null);

  const revisar = useMutation({
    mutationFn: async () => {
      const g = await guardarTodo();
      if (g.error) return { error: g.error } as { error: string; data?: undefined };
      return syncApi.ripleyPublishPreview(product!.id, esGrupo);
    },
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo revisar el envío");
      setVista(res.data);
      setEnvio(null);
    },
    onError: () => toast.error("Error al revisar el envío a Ripley"),
  });

  const enviar = useMutation({
    mutationFn: () => syncApi.ripleyPublish(product!.id, { alGrupo: esGrupo, confirmar: true }),
    onSuccess: (res) => {
      setConfirmando(false);
      if (res.error || !res.data) return toast.error(res.error ?? "Ripley no recibió el envío");
      setEnvio({ importId: res.data.importId, productImportId: res.data.productImportId, enviados: res.data.enviados });
      toast.success("Enviado a Ripley. Ahora Ripley lo procesa: abajo ves cómo va.");
    },
    onError: () => { setConfirmando(false); toast.error("Error al enviar a Ripley"); },
  });

  // Mientras Ripley procesa se consulta cada 20 s (Mirakl pide no consultar una importación más de una vez por minuto; para un piloto basta).
  const { data: seguimiento } = useQuery({
    queryKey: ["ripley-import", envio?.importId, envio?.productImportId],
    queryFn: () => syncApi.ripleyImportStatus(envio!.importId, envio!.productImportId),
    enabled: !!envio,
    refetchInterval: (q) => (q.state.data?.data?.resumen === "en-curso" || !q.state.data ? 20_000 : false),
  });
  const estadoDeEnvio = seguimiento?.data ?? null;

  const dibujar = (campo: RipleyCampo) => (
    <div key={campo.name} className="space-y-1">
      <Label htmlFor={`rp-attr-${campo.name}`} className="text-xs">
        {campo.label}
        {campo.required ? <span className="ml-1 text-[10px] text-destructive font-normal">obligatorio</span> : <span className="ml-1 text-[10px] text-muted-foreground font-normal">{campo.level === "RECOMMENDED" ? "recomendado" : "opcional"}</span>}
        {estimados.includes(campo.name) && <span className="ml-1 text-[10px] text-amber-500 font-normal">estimado por la IA: revísalo</span>}
      </Label>
      {campo.options && campo.options.length > 0 ? (
        <Select value={valores[campo.name] ?? ""} onValueChange={(v) => poner(campo.name, v)}>
          <SelectTrigger id={`rp-attr-${campo.name}`}><SelectValue placeholder="Elige una opción" /></SelectTrigger>
          <SelectContent className="max-h-60">
            {campo.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : campo.listaLarga ? (
        <CampoDeListaLarga campo={campo} valor={valores[campo.name] ?? ""} onChange={(v) => poner(campo.name, v)} />
      ) : (
        <Input id={`rp-attr-${campo.name}`} value={valores[campo.name] ?? ""} onChange={(e) => poner(campo.name, e.target.value)} />
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[88vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PackageCheck className="w-4 h-4" /> Preparar para Ripley</DialogTitle>
          <DialogDescription className="break-words">
            {product?.name}{esGrupo ? ` (las ${product?.groupSummary?.variantCount} variantes)` : ""}. Ripley pide una categoría de su catálogo y los datos propios de esa categoría. Esto solo guarda en Synkro: no envía nada a Ripley.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {analizar.isPending && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> La IA está analizando el producto (categoría, atributos y contenido)…</p>
          )}
          {aviso && (
            <p className="text-xs rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 flex items-start gap-2"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span className="break-words">{aviso}</span></p>
          )}

          {/* ── Categoría ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Categoría de Ripley</Label>
              {/* Sin categoría la IA la sugiere; con categoría elegida solo llena los atributos vacíos y NUNCA la cambia. */}
              {product && !categoria && !analizar.isPending && (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => analizar.mutate()}><Sparkles className="w-3 h-3 mr-1" /> Sugerir categoría con IA</Button>
              )}
            </div>
            {categoria ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words">{categoria.path}</p>
                  <p className="text-xs text-muted-foreground">Código {categoria.id}</p>
                </div>
                {/* Cambiar la categoría de Ripley no borra lo escrito (ni toca los datos de otros canales): al guardar se descartan solo los campos que la nueva categoría no tenga. */}
                <Button variant="ghost" size="sm" onClick={() => setCategoria(null)}>Cambiar</Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Escribe qué vendes: lonchera, mochila, sandalias…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>
                {busqueda.trim().length > 0 && busqueda.trim().length < 3 && <p className="text-xs text-muted-foreground">Escribe al menos 3 letras.</p>}
                {buscando && <Skeleton className="h-16 w-full" />}
                {!buscando && busquedaDiferida.trim().length >= 3 && (
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border/50">
                    {(categorias?.data ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3">Ninguna categoría coincide. Prueba con otra palabra.</p>
                    ) : (
                      (categorias?.data ?? []).map((c) => (
                        <button key={c.id} onClick={() => { setCategoria({ id: c.id, path: c.path }); setBusqueda(""); setAviso(null); }} className="w-full text-left p-3 hover:bg-secondary/40 transition-colors">
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground break-words">{c.path}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
            {/* En un grupo: si los ejes del producto caben en UNA publicación según esta categoría; si no, se publican separados y se recomienda otra categoría. */}
            {esGrupo && categoria && product?.group?.id && (
              <VariantCompatNotice
                groupId={product.group.id}
                marketplaces={["ripley"]}
                categoryId={categoria.id}
                onUseCategory={(_canal, c) => { setCategoria({ id: c.id, path: c.ruta }); setAviso(null); }}
              />
            )}
            {esGrupo && info?.admiteVariantes && (
              <p className="text-[11px] text-muted-foreground">
                Las variantes se agrupan por: {info.campos.filter((c) => c.isVariant).map((c) => c.label).join(" y ")}. Esos datos se toman de cada variante.
              </p>
            )}
          </div>

          {/* ── Contenido de Ripley ───────────────────────────────────── */}
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="rp-nombre" className="text-xs">Nombre en Ripley <span className="text-muted-foreground font-normal">({nombre.length}/125, siempre en mayúsculas)</span></Label>
              <Input id="rp-nombre" maxLength={125} value={nombre} onChange={(e) => setNombre(e.target.value.toLocaleUpperCase("es"))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rp-corta" className="text-xs">Descripción corta <span className="text-muted-foreground font-normal">(texto plano, máx. 250)</span></Label>
              <Input id="rp-corta" maxLength={250} value={corta} onChange={(e) => setCorta(e.target.value)} />
            </div>
            <p className="text-[11px] text-muted-foreground">La descripción completa es la ficha HTML general del producto (la misma de los demás canales).</p>
          </div>

          {/* ── Marca ─────────────────────────────────────────────────── */}
          {product && <RipleyBrandField productIds={idsDe(product)} value={marca} onSaved={(m) => setMarca(m)} />}

          {/* ── Campos de la categoría ────────────────────────────────── */}
          {categoria && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Label>Datos que pide esta categoría</Label>
                {!cargandoCampos && <Badge variant="outline" className="text-[10px]">{obligatorios.length} obligatorios · {otros.length} más</Badge>}
                {!cargandoCampos && faltan.length > 0 && <Badge variant="outline" className="text-[10px] border-amber-500/50">faltan {faltan.length} obligatorios</Badge>}
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs ml-auto" disabled={rellenar.isPending || cargandoCampos} onClick={() => rellenar.mutate()}>
                  {rellenar.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                  {rellenar.isPending ? "Llenando…" : "Llenar atributos vacíos"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">La IA completa solo lo que está vacío: no cambia la categoría ni lo que ya escribiste.</p>
              {sinValor.length > 0 && !rellenar.isPending && (
                <p className="text-[11px] text-muted-foreground">La IA no pudo deducir: {sinValor.map((n) => campos.find((c) => c.name === n)?.label ?? n).join(", ")}. Complétalos a mano.</p>
              )}
              {cargandoCampos ? <Skeleton className="h-10 w-full" /> : <div className="space-y-3">{[...obligatorios, ...otros].map(dibujar)}</div>}
            </div>
          )}
        </div>

        {/* ── Enviar a Ripley ───────────────────────────────────────── */}
        {categoria && (
          <div className="rounded-xl border border-border p-3 space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-medium flex items-center gap-1.5"><Send className="w-4 h-4" /> Enviar a Ripley</p>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={revisar.isPending || guardar.isPending || !listo} onClick={() => revisar.mutate()}>
                {revisar.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                {revisar.isPending ? "Revisando…" : "Guardar y revisar envío"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Primero se guarda lo de arriba y se revisa qué se enviaría y si Ripley lo aceptaría. Revisar no envía nada.</p>

            {vista && (
              <div className="space-y-2 text-xs min-w-0">
                {vista.errores.map((e, i) => <p key={i} className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 break-words">{e}</p>)}
                {vista.publicaComo !== "sola" && (
                  <p className="rounded-lg border border-border p-2 text-muted-foreground break-words">
                    {vista.publicaComo === "una" ? "Las variantes se enviarán en UNA sola publicación de Ripley." : "Las variantes se enviarán como productos separados."} {vista.avisosDeVariantes.join(" ")}
                  </p>
                )}
                {vista.productos.map((p) => (
                  <div key={p.sku} className={`rounded-lg border p-2 space-y-1 min-w-0 ${p.errores.length ? "border-destructive/40" : "border-border"}`}>
                    <p className="font-medium break-words">{p.sku} · {p.nombre || "(sin nombre)"}</p>
                    <p className="text-muted-foreground">Precio S/ {p.precio ?? "—"} · Stock {p.stock ?? "—"}</p>
                    {p.errores.map((e, i) => <p key={i} className="text-destructive break-words">• {e}</p>)}
                    {p.avisos.map((a, i) => <p key={i} className="text-amber-600 dark:text-amber-400 break-words">• {a}</p>)}
                    {!p.errores.length && <p className="text-green-600 dark:text-green-400">Listo para enviar</p>}
                  </div>
                ))}
                {vista.bloqueo && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 break-words">{vista.bloqueo.motivo}</p>
                )}
                {!vista.envioEncendido && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 break-words">La publicación en Ripley está apagada en el servidor, así que por ahora solo se puede revisar. Para enviar hay que encenderla (RIPLEY_PUBLISH_ENABLED).</p>
                )}
                {vista.envioEncendido && vista.skusNoPermitidos.length > 0 && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 break-words">Estos SKU no están en la lista permitida del servidor (RIPLEY_PUBLISH_SKUS): {vista.skusNoPermitidos.join(", ")}.</p>
                )}
                <Button
                  type="button"
                  size="sm"
                  disabled={!vista.puedeEnviar || !vista.envioEncendido || vista.skusNoPermitidos.length > 0 || !!vista.bloqueo || enviar.isPending || !!envio}
                  onClick={() => setConfirmando(true)}
                >
                  <Send className="w-3.5 h-3.5 mr-2" /> Enviar a Ripley
                </Button>
              </div>
            )}

            {envio && (
              <div className="rounded-lg border border-border p-2.5 text-xs space-y-1 min-w-0">
                <p className="font-medium flex items-center gap-1.5">
                  {!estadoDeEnvio || estadoDeEnvio.resumen === "en-curso" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : estadoDeEnvio.resumen === "listo" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                  {!estadoDeEnvio || estadoDeEnvio.resumen === "en-curso" ? "Ripley está procesando lo enviado…" : estadoDeEnvio.resumen === "listo" ? "Ripley lo procesó sin errores" : "Ripley encontró errores"}
                </p>
                {estadoDeEnvio && (
                  <p className="text-muted-foreground">
                    Productos: {estadoDeEnvio.productos?.estado ?? "—"} ({estadoDeEnvio.productos?.correctas ?? 0} bien, {estadoDeEnvio.productos?.conError ?? 0} con error) · Ofertas: {estadoDeEnvio.ofertas.estado ?? "—"} ({estadoDeEnvio.ofertas.correctas ?? 0} bien, {estadoDeEnvio.ofertas.conError ?? 0} con error)
                  </p>
                )}
                {[...(estadoDeEnvio?.errores.productos ?? []), ...(estadoDeEnvio?.errores.ofertas ?? [])].map((e, i) => <p key={i} className="text-destructive break-words">• {e}</p>)}
                {estadoDeEnvio?.resumen === "listo" && <p className="text-muted-foreground">Ripley puede tardar en mostrarlo en su sitio. Luego actualiza Marketplaces para que Synkro lo reconozca.</p>}
              </div>
            )}
          </div>
        )}

        <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Enviar a Ripley?</AlertDialogTitle>
              <AlertDialogDescription>
                Se creará la ficha y la oferta de {vista?.productos.length ?? 0} producto(s) en el catálogo REAL de tu tienda en Ripley: {vista?.productos.map((p) => p.sku).join(", ")}. Esto no se puede deshacer desde Synkro.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={enviar.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction disabled={enviar.isPending} onClick={(e) => { e.preventDefault(); enviar.mutate(); }}>
                {enviar.isPending ? "Enviando…" : "Sí, enviar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={guardar.isPending}>Cancelar</Button>
          <Button onClick={() => guardar.mutate()} disabled={!listo || guardar.isPending}>
            {guardar.isPending ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-2" />}
            {guardar.isPending ? "Guardando…" : "Guardar para Ripley"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
