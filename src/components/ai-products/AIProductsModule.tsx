import { useQueryClient } from "@tanstack/react-query";
import { AccountChooser, CuentasPorCanal } from "@/components/marketplaces/AccountChooser";
import { CargasMasivas } from "./CargasMasivas";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { MarketplaceSelector } from "./MarketplaceSelector";
import { ProductInputForm } from "./ProductInputForm";
import { GeneratedFieldsPreview } from "./GeneratedFieldsPreview";
import { PackageReview } from "./PackageReview";
import { LaunchStatus } from "./LaunchStatus";
import { Button } from "@/components/ui/button";
import { syncApi, LaunchReport } from "@/lib/sync-api";
import { Loader2, Sparkles } from "lucide-react";
import { productsApi } from "@/lib/products-api";
import { bulkUploadApi } from "@/lib/bulk-upload-api";
import { uploadApi } from "@/lib/upload-api";
import { variantsApi, type VistaDeGrupo } from "@/lib/variants-api";
import type { ResultadoDelRecorrido } from "./VariantsWizard";
import { toast } from "sonner";
import { useFormDraft } from "@/contexts/FormDraftContext";

/** Canales que Synkro publica por sí mismo desde aquí; el resto se avisa en la revisión en vez de omitirse en silencio. */
const CANALES_LANZABLES = ["mercadolibre", "falabella", "woocommerce", "ripley"];
const NOMBRE_DE_CANAL: Record<string, string> = { mercadolibre: "Mercado Libre", falabella: "Falabella", woocommerce: "WooCommerce", ripley: "Ripley", amazon: "Amazon", shopify: "Shopify", juntoz: "Juntoz", yape: "Yape" };

interface AIProductsModuleProps {
  /** Dentro de una ventana: sin la tarjeta de bienvenida. */
  compact?: boolean;
  /** Se llama cuando el producto ya se creó y cuando termina el lanzamiento, para refrescar listados. */
  onCreated?: () => void;
}

export function AIProductsModule({ compact = false, onCreated }: AIProductsModuleProps = {}) {
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasGeneratedContent, setHasGeneratedContent] = useState(false);
  const [generatedProduct, setGeneratedProduct] = useState<any>(null);
  const [launch, setLaunch] = useState<LaunchReport | null>(null);
  const [launching, setLaunching] = useState(false);
  // El último paso solo preparó los canales: la persona revisa y confirma antes de que se publique nada.
  const [enRevision, setEnRevision] = useState(false);
  // Cuentas elegidas por canal (si la tienda tiene varias).
  const [cuentas, setCuentas] = useState<CuentasPorCanal>({});
  const queryClient = useQueryClient();
  // En carga masiva los canales van en la columna `canales` del Excel; sin ella se usan todos los conectados.
  const [modoCarga, setModoCarga] = useState<"single" | "bulk">("single");
  const esMasivo = modoCarga === "bulk";
  const cuentasDe = (canales: string[]) => Object.fromEntries(canales.filter((c) => cuentas[c]?.length).map((c) => [c, cuentas[c]]));
  // Al cambiar, el formulario se vacía: queda listo para el siguiente producto.
  const [formKey, setFormKey] = useState(0);
  // Resultado de crear un producto con variantes.
  const [grupoCreado, setGrupoCreado] = useState<VistaDeGrupo | null>(null);
  const { setDirty } = useFormDraft();

  // Report dirty state whenever the user configures anything
  useEffect(() => {
    // En la ventana de Nuevo producto no se avisa al cambiar de sección: la ventana se cierra sola.
    if (compact) return;
    const dirty = selectedMarketplaces.length > 0 || selectedCategory !== "";
    setDirty("ai-products", dirty);
  }, [selectedMarketplaces, selectedCategory, setDirty, compact]);
  /** Prepara cada canal (categoría, marca, medidas, atributos, descripción HTML) y publica el producto. */
  const lanzar = async (productId: string, opciones: { grupo?: boolean; meliCategoryId?: string; soloPreparar?: boolean } = {}) => {
    const canales = selectedMarketplaces.filter((m) => CANALES_LANZABLES.includes(m));
    if (!canales.length) {
      toast.info("Shopify y otros canales todavía no se publican automáticamente.");
      return;
    }
    setLaunching(true);
    setEnRevision(!!opciones.soloPreparar);
    try {
      const res = await syncApi.launchProduct(productId, canales, cuentasDe(canales), opciones.meliCategoryId, opciones.soloPreparar);
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudo publicar");
        return;
      }
      setLaunch(res.data);
      onCreated?.();
      // «Faltan datos obligatorios» salió al generar; al preparar el canal esos datos se completan. Si el canal ya está listo, el aviso es viejo.
      const listos = [res.data.falabella?.listo ? "falabella" : null, res.data.ripley?.listo ? "ripley" : null].filter(Boolean) as string[];
      if (listos.length) {
        setGeneratedProduct((p: any) => p ? { ...p, aiReport: { ...(p.aiReport ?? {}), missingAttributes: Object.fromEntries(Object.entries(p.aiReport?.missingAttributes ?? {}).filter(([canal]) => !listos.includes(canal))) } } : p);
      }
      // El servidor eligió categoría, marca y medidas al preparar Falabella: la tarjeta de medidas debe verlos.
      const f = res.data.falabella;
      // En un grupo no hay un solo producto cuya tarjeta de medidas actualizar.
      if (f && !opciones.grupo) {
        setGeneratedProduct((p: any) => ({
          ...p,
          marketplaceIds: { ...(p?.marketplaceIds ?? {}), ...(f.category ? { falabella_category_id: f.category.id } : {}) },
          packageWidth: f.measures.width,
          packageLength: f.measures.length,
          packageHeight: f.measures.height,
          packageWeight: f.measures.weight,
          aiAttributes: { ...(p?.aiAttributes ?? {}), brand: f.brand.value, estimated: { ...(p?.aiAttributes?.estimated ?? {}), measures: f.measures.estimated } },
        }));
      }
      res.data.channels.forEach((c) =>
        c.status === "error" ? toast.error(c.message) : c.status === "omitido" ? toast.info(c.message) : toast.success(c.message),
      );
    } finally {
      setLaunching(false);
    }
  };

  const handleSubmit = async (data: {
    mode: "single" | "bulk";
    content: string;
    sku: string;
    price?: number;
    stock?: number;
    images: File[];
    bulkFile?: File;
    zipFile?: File;
  }) => {
    setIsProcessing(true);
    try {
      if (data.mode === "bulk") {
        // ── Carga masiva: envía el Excel al endpoint de bulk-upload ──
        if (!data.bulkFile) {
          toast.error("No se encontró el archivo Excel.");
          return;
        }
        const response = await bulkUploadApi.uploadProducts(data.bulkFile, data.zipFile, [], {});
        if (response.error) {
          toast.error(response.error);
        } else {
          const rechazos = response.data?.rejectedDetails ?? [];
          toast.success(response.data?.message ?? "Productos encolados correctamente");
          if (rechazos.length) {
            toast.warning(`No se cargaron ${rechazos.length} fila(s):\n${rechazos.slice(0, 6).join("\n")}${rechazos.length > 6 ? "\n…" : ""}`, { duration: 20000 });
          }
          // El formulario se limpia: así no se puede enviar el mismo archivo otra vez por error mientras se procesa.
          setFormKey((k) => k + 1);
          setDirty("ai-products", false);
          queryClient.invalidateQueries({ queryKey: ["bulk-batches"] });
        }
      } else {
        // ── Producto individual: genera contenido con IA ──
        const dto = {
          sku: data.sku,
          // Sin texto, la IA arma el nombre y la descripción a partir de las fotos.
          name: data.content.trim() || undefined,
          description: data.content.trim() || undefined,
          category: selectedCategory,
          targetMarketplaces: selectedMarketplaces,
          price: data.price,
          stock: data.stock,
        };
        const response = await productsApi.createWithAIAndFiles(dto, data.images);
        if (response.error) {
          toast.error(response.error);
        } else {
          setHasGeneratedContent(true);
          setGeneratedProduct(response.data);
          setLaunch(null);
          setFormKey((k) => k + 1);
          setDirty("ai-products", false);
          onCreated?.();
          toast.success("Contenido generado. Preparando tus canales para que lo revises…");
          // Se deja listo cada canal, pero NO se publica: la persona revisa los datos generados y confirma.
          if (response.data?.id) await lanzar(response.data.id, { soloPreparar: true });
        }
      }
    } catch (error) {
      toast.error("Error al conectar con el servidor");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  /** Producto con variantes: sube las fotos usadas, crea el grupo y genera con IA el contenido una sola vez. */
  const handleVariants = async (data: { sku: string; content: string; images: File[]; wizard: ResultadoDelRecorrido }) => {
    setIsProcessing(true);
    try {
      const usados = [...new Set(data.wizard.variants.flatMap((v) => v.photoIndexes))].sort((a, b) => a - b);
      const urlPorIndice: Record<number, string> = {};
      for (let i = 0; i < usados.length; i += 10) {
        const lote = usados.slice(i, i + 10);
        const resp = await uploadApi.uploadImages(lote.map((ix) => data.images[ix]));
        const subidas = resp.data?.images ?? [];
        if (resp.error || subidas.length !== lote.length) {
          toast.error(resp.error ?? "No se pudieron subir las fotos. Inténtalo de nuevo.");
          return;
        }
        lote.forEach((ix, j) => { urlPorIndice[ix] = subidas[j].url; });
      }

      const contenido = data.content.trim();
      const res = await variantsApi.createGroup({
        // Sin SKU escrito, el servidor asigna el del grupo y los de las variantes.
        ...(data.sku.trim() ? { parentSku: data.sku.trim() } : {}),
        // Un texto corto es el nombre; uno largo es la descripción. Sin texto, la IA arma ambos desde las fotos.
        ...(contenido && contenido.length <= 120 ? { name: contenido } : {}),
        description: contenido || undefined,
        targetMarketplaces: selectedMarketplaces,
        generateWithAi: true,
        axes: data.wizard.axes,
        variants: data.wizard.variants.map((v) => ({
          values: v.values,
          // Solo si la persona lo cambió; sin él, el servidor asigna el suyo.
          ...(v.sku ? { sku: v.sku } : {}),
          price: v.price,
          stock: v.stock,
          images: v.photoIndexes.map((ix) => urlPorIndice[ix]),
        })),
      });
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudo crear el producto con variantes");
        return;
      }
      setGrupoCreado(res.data);
      setHasGeneratedContent(false);
      setGeneratedProduct(null);
      setLaunch(null);
      setFormKey((k) => k + 1);
      setDirty("ai-products", false);
      onCreated?.();
      if (res.data.ia?.ok === false) {
        toast.warning(`Variantes creadas, pero la IA no pudo completar el contenido: ${res.data.ia.motivo ?? "error desconocido"}`);
      } else {
        toast.success(`Producto con ${res.data.variants.length} variantes creado. Preparando tus canales para que lo revises…`);
        // Igual que un producto individual: se deja listo cada canal, pero NO se publica hasta que la persona confirme.
        if (res.data.variants[0]) await lanzar(res.data.variants[0].id, { grupo: true, soloPreparar: true });
      }
    } catch (error) {
      toast.error("Error al conectar con el servidor");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Resultado del lanzamiento: una tarjeta por canal elegido, con su estado en una línea y el detalle plegado. Mientras los canales solo
   * están preparados, la persona revisa y confirma; recién entonces se publica.
   */
  const renderLaunch = (estados: { id: string; etiqueta?: string }[], relanzarId?: string) => {
    const preparado = !!launch?.channels.some((c) => c.status === "preparado");
    const grupo = estados.length > 1;
    const variantes = launch?.variants ?? [];
    const verMeli = variantes.some((v) => v.titulos.mercadolibre);
    const verFala = variantes.some((v) => v.titulos.falabella);
    const sinPublicarAuto = selectedMarketplaces.filter((m) => !CANALES_LANZABLES.includes(m));
    const estimados: string[] = [];
    if (launch?.estimatedMeli?.length) estimados.push(`Mercado Libre (${launch.estimatedMeli.length} datos)`);
    if (launch?.falabella?.measures?.estimated) estimados.push("medidas del paquete (Falabella)");

    /** Las líneas que se ven al desplegar «Ver detalle» de un canal. */
    const detalleDe = (canal: string): string[] => {
      if (!launch) return [];
      const l: string[] = [];
      if (canal === "mercadolibre" && launch.meliCategory?.id) l.push(`Categoría: ${launch.meliCategory.path ?? launch.meliCategory.id}`);
      if (canal === "falabella" && launch.falabella) {
        const f = launch.falabella;
        l.push(`Categoría: ${f.category ? f.category.path : "sin categoría"}`);
        l.push(`Marca: ${f.brand.value}`);
        if (f.attributes) l.push(`Atributos con valor: ${f.attributes.filled} de ${f.attributes.total}`);
        if (f.categoryNote) l.push(f.category ? `Revisa la categoría: ${f.categoryNote}. Puedes cambiarla desde Publicar → Preparar para Falabella.` : `No se encontró una categoría segura (${f.categoryNote}): elígela desde Publicar → Preparar para Falabella.`);
      }
      if (canal === "ripley" && launch.ripley) {
        const r = launch.ripley;
        l.push(`Categoría: ${r.category ? r.category.path : "sin categoría"}`);
        if (r.brand) l.push(`Marca: ${r.brand}`);
        if (r.attributes) l.push(`Atributos con valor: ${r.attributes.filled} de ${r.attributes.total}`);
        l.push(...r.avisos.slice(0, 3));
      }
      return l;
    };

    const tarjeta = (c: { marketplace: string; status: string; message: string }) => {
      const nombre = NOMBRE_DE_CANAL[c.marketplace] ?? c.marketplace;
      const color = c.status === "error" ? "text-red-400" : c.status === "omitido" ? "text-amber-500" : "text-green-500";
      const icono = c.status === "error" ? "✗" : c.status === "omitido" ? "•" : "✓";
      const resumen = c.status === "preparado"
        ? `Listo para publicar${grupo ? ` las ${estados.length} variantes` : ""}`
        : c.message.replace(new RegExp(`^${nombre}:\\s*`), "");
      const detalle = detalleDe(c.marketplace);
      return (
        <div key={c.marketplace} className="rounded-lg border border-border p-2.5">
          <div className="flex items-start gap-2 text-sm">
            <span className={color}>{icono}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{nombre}</p>
              <p className={`text-xs break-words ${color}`}>{resumen}</p>
            </div>
          </div>
          {detalle.length > 0 && (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-[11px] text-muted-foreground">Ver detalle</summary>
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground break-words">{detalle.map((t, i) => <p key={i}>{t}</p>)}</div>
            </details>
          )}
        </div>
      );
    };

    return (
      <>
        {launching && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> {enRevision ? "La IA está preparando cada canal…" : "Publicando en tus canales…"}
          </div>
        )}

        {launch && !launching && (
          <div className={`mt-4 rounded-xl border p-3 md:p-4 space-y-3 ${preparado ? "border-amber-500/50" : "border-border"}`}>
            <div>
              <p className="text-sm font-medium">{preparado ? "Revisa antes de publicar" : "Resultado de la publicación"}</p>
              {preparado && <p className="text-xs text-muted-foreground">Nada se ha publicado todavía. Corrige lo que haga falta en la Ficha y confirma.</p>}
            </div>

            <div className="space-y-2">
              {launch.channels.map(tarjeta)}
              {sinPublicarAuto.map((m) => (
                <div key={m} className="rounded-lg border border-border p-2.5 text-sm">
                  <p className="font-medium">{NOMBRE_DE_CANAL[m] ?? m}</p>
                  <p className="text-xs text-amber-500">Todavía no se publica automáticamente desde aquí; el contenido queda generado en Synkro.</p>
                </div>
              ))}
            </div>

            {estimados.length > 0 && (
              <p className="text-xs text-amber-500 break-words">La IA estimó algunos datos: {estimados.join(" · ")}. Revísalos en la Ficha antes de publicar.</p>
            )}

            {preparado && grupo && variantes.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground text-left">
                      <th className="font-normal pb-1 pr-3">Variante</th>
                      <th className="font-normal pb-1 pr-3">SKU</th>
                      <th className="font-normal pb-1 pr-3">Precio</th>
                      <th className="font-normal pb-1 pr-3">Stock</th>
                      {verMeli && <th className="font-normal pb-1 pr-3">Título en Mercado Libre</th>}
                      {verFala && <th className="font-normal pb-1">Título en Falabella</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {variantes.map((v) => (
                      <tr key={v.id} className="border-t border-border align-top">
                        <td className="py-1.5 pr-3 whitespace-nowrap">{v.etiqueta}</td>
                        <td className="py-1.5 pr-3 font-mono">{v.sku}</td>
                        <td className="py-1.5 pr-3">{v.price != null ? `S/ ${v.price.toFixed(2)}` : "—"}</td>
                        <td className="py-1.5 pr-3">{v.stock ?? "—"}</td>
                        {verMeli && <td className="py-1.5 pr-3 break-words min-w-[160px]">{v.titulos.mercadolibre}</td>}
                        {verFala && <td className="py-1.5 break-words min-w-[160px]">{v.titulos.falabella}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {preparado && relanzarId && (
              <div className="pt-1">
                <Button className="h-auto min-h-9 whitespace-normal text-left" disabled={launching} onClick={() => lanzar(relanzarId, { grupo, meliCategoryId: launch.meliCategory?.id })}>
                  Confirmar y publicar{grupo ? ` las ${estados.length} variantes` : ""}
                </Button>
              </div>
            )}

            {!preparado && estados.map((e) => <LaunchStatus key={e.id} productId={e.id} etiqueta={e.etiqueta} />)}
          </div>
        )}

        {launch?.meliCategory && !launch.meliCategory.id && (launch.meliCategory.options?.length ?? 0) > 0 && relanzarId && !launching && (
          <div className="mt-4 rounded-xl border border-amber-500/40 p-3 md:p-4 space-y-2">
            <p className="text-sm font-medium">Elige la categoría de Mercado Libre</p>
            <p className="text-xs text-muted-foreground">No se pudo elegir sola con seguridad. Estas son las más cercanas; al elegir una, {enRevision ? "vuelves a ver la revisión antes de publicar" : "se publica en Mercado Libre"}.</p>
            {launch.meliCategory.options!.map((o) => (
              <Button key={o.id} variant="outline" size="sm" className="w-full justify-start h-auto py-2 text-left whitespace-normal" disabled={launching} onClick={() => lanzar(relanzarId, { grupo, meliCategoryId: o.id, soloPreparar: enRevision })}>
                {o.path}
              </Button>
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
      {/* Hero Section: solo en la página, no dentro de la ventana de Nuevo producto */}
      {!compact && (
        <Card className="p-4 md:p-8 bg-white dark:bg-[#111111] shadow-[0_10px_30px_rgba(0,0,0,0.08)] dark:shadow-none border border-[#EAEAEA] dark:border-white/20 overflow-hidden relative rounded-[20px] transition-colors duration-200">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#FCCB34] opacity-5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
  
          <div className="relative flex flex-col sm:flex-row items-start gap-4 md:gap-6">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-[#FCCB34] shadow-[0_8px_16px_rgba(252,203,52,0.3)] flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-[#111111]" />
            </div>
  
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-[#111111] dark:text-[#F8F8F5]">Optimiza tus productos con IA</h2>
              <p className="text-sm md:text-base text-[#666666] dark:text-[#A1A1AA] mt-2 max-w-xl leading-relaxed">
                Ingresa información básica de tus productos y nuestra IA generará
                automáticamente títulos optimizados, descripciones atractivas y
                todos los campos necesarios para cada marketplace.
              </p>
  
              <div className="flex flex-wrap gap-2 md:gap-3 mt-4">
                <span className="text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-[#FFF1B8] dark:bg-[#FCCB34]/20 text-[#111111] dark:text-[#FCCB34] font-semibold border border-[#FCCB34]/30 dark:border-[#FCCB34]/20 shadow-sm">
                  ✨ Títulos SEO optimizados
                </span>
                <span className="text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-[#F8F8F5] dark:bg-[#1A1A1A] text-[#111111] dark:text-[#F8F8F5] font-medium border border-[#EAEAEA] dark:border-white/20 shadow-sm">
                  📝 Descripciones que venden
                </span>
                <span className="text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-white dark:bg-[#222222] text-[#111111] dark:text-[#F8F8F5] font-medium border border-[#EAEAEA] dark:border-white/20 shadow-sm">
                  🏷️ Atributos automáticos
                </span>
              </div>
            </div>
          </div>
        </Card>
  
      )}

      {/* Step 1: Marketplaces (en carga masiva no se pide: los canales van en el Excel) */}
      {!esMasivo && (
        <Card className="p-4 md:p-6 bg-white dark:bg-[#111111] shadow-sm border border-[#EAEAEA] dark:border-white/20 rounded-[16px] transition-colors duration-200">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#FCCB34] text-[#111111] text-xs md:text-sm font-bold flex items-center justify-center shadow-sm">
              1
            </span>
            <span className="font-semibold text-[#111111] dark:text-[#F8F8F5] text-sm md:text-base tracking-tight">Selecciona los canales destino</span>
          </div>
          <MarketplaceSelector
            selected={selectedMarketplaces}
            onChange={setSelectedMarketplaces}
          />
          <AccountChooser canales={selectedMarketplaces} value={cuentas} onChange={setCuentas} className="mt-4" />
        </Card>
      )}

      {/* Step 2: Product Input */}
      <Card className="p-4 md:p-6 bg-white dark:bg-[#111111] shadow-sm border border-[#EAEAEA] dark:border-white/20 rounded-[16px] transition-colors duration-200">
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#FCCB34] text-[#111111] text-xs md:text-sm font-bold flex items-center justify-center shadow-sm">
            {esMasivo ? 1 : 2}
          </span>
          <span className="font-semibold text-[#111111] dark:text-[#F8F8F5] text-sm md:text-base tracking-tight">Ingresa la información del producto</span>
        </div>
        <ProductInputForm
          key={formKey}
          onSubmit={(d) => { setGrupoCreado(null); return handleSubmit(d); }}
          onSubmitVariants={handleVariants}
          isProcessing={isProcessing}
          isFormReady={esMasivo || selectedMarketplaces.length > 0}
          onModeChange={setModoCarga}
        />
      </Card>

      {/* Cargas masivas en curso e historial (en la ventana «Nuevo producto», solo al elegir carga masiva) */}
      {(!compact || esMasivo) && <CargasMasivas />}

      {/* Resultado de un producto con variantes */}
      {grupoCreado && (
        <Card className="p-4 md:p-6 bg-white dark:bg-[#111111] shadow-sm border border-[#EAEAEA] dark:border-white/20 rounded-[16px] space-y-3 animate-in fade-in duration-300">
          <div>
            <p className="font-semibold text-sm md:text-base">Producto con {grupoCreado.variants.length} variantes creado</p>
            <p className="text-xs text-muted-foreground">Código del grupo: {grupoCreado.parentSku} · {grupoCreado.axes.map((e) => e.name).join(" y ")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="font-normal pb-1 pr-3">Variante</th>
                  <th className="font-normal pb-1 pr-3">SKU</th>
                  <th className="font-normal pb-1 pr-3">Precio</th>
                  <th className="font-normal pb-1 pr-3">Stock</th>
                  <th className="font-normal pb-1">Fotos</th>
                </tr>
              </thead>
              <tbody>
                {grupoCreado.variants.map((v) => (
                  <tr key={v.id} className="border-t border-border">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{Object.values(v.variantValues ?? {}).join(" · ")}</td>
                    <td className="py-1.5 pr-3 font-mono">{v.sku}</td>
                    <td className="py-1.5 pr-3">{v.price != null ? `S/ ${v.price.toFixed(2)}` : "—"}</td>
                    <td className="py-1.5 pr-3">{v.stock}</td>
                    <td className="py-1.5">{v.images.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {grupoCreado.ia?.ok === false ? (
            <p className="text-xs text-amber-500">La IA no pudo completar el contenido ({grupoCreado.ia.motivo ?? "error desconocido"}). Puedes completarlo desde la Ficha de cada variante.</p>
          ) : (
            <p className="text-xs text-green-500">La IA preparó el contenido del grupo una sola vez y lo repartió entre las variantes.</p>
          )}
          {renderLaunch(grupoCreado.variants.map((v) => ({ id: v.id, etiqueta: Object.values(v.variantValues ?? {}).join(" · ") })), grupoCreado.variants[0]?.id)}
          <Button variant="outline" onClick={() => setGrupoCreado(null)}>Crear otro producto</Button>
        </Card>
      )}

      {/* Step 3: Generated Fields Preview */}
      {hasGeneratedContent && (
        <Card className="p-4 md:p-6 bg-white dark:bg-[#111111] shadow-sm border border-[#EAEAEA] dark:border-white/20 rounded-[16px] transition-colors duration-200">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#111111] dark:bg-[#FCCB34] text-white dark:text-[#111111] text-xs md:text-sm font-bold flex items-center justify-center shadow-sm">
              3
            </span>
            <span className="font-semibold text-[#111111] dark:text-[#F8F8F5] text-sm md:text-base tracking-tight">Revisa los resultados</span>
          </div>
          <GeneratedFieldsPreview visible={hasGeneratedContent} productData={generatedProduct} />

          {selectedMarketplaces.includes("falabella") && generatedProduct && (
            <div className="mt-4">
              <PackageReview
                product={generatedProduct}
                onReviewed={(m) =>
                  setGeneratedProduct((p: any) => ({
                    ...p,
                    ...m,
                    aiAttributes: { ...(p.aiAttributes ?? {}), estimated: { ...(p.aiAttributes?.estimated ?? {}), measures: false } },
                  }))
                }
              />
            </div>
          )}

          {renderLaunch(generatedProduct?.id ? [{ id: generatedProduct.id }] : [], generatedProduct?.id)}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                setHasGeneratedContent(false);
                setGeneratedProduct(null);
                setLaunch(null);
                setFormKey((k) => k + 1);
              }}
            >
              Crear otro producto
            </Button>
            <span className="text-xs text-muted-foreground">El producto queda en Productos.</span>
          </div>

        </Card>
      )}
    </div>
  );
}
