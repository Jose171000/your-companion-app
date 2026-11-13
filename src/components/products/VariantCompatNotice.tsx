import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Info, Lightbulb, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { productsApi, type DetalleDeEje, type EstadoDeValor, type SugerenciaDeAjustes, type VariantCompatResult } from "@/lib/products-api";
import { useStores } from "@/contexts/StoreContext";

const CANALES_REVISABLES = ["ripley", "falabella", "mercadolibre", "shopify", "woocommerce"];

interface Props {
  /** El grupo de variantes. */
  groupId: string;
  /** Canales a revisar. */
  marketplaces: string[];
  /** Si se revisa un solo canal, la categoría que se está eligiendo ahora (aún sin guardar). */
  categoryId?: string;
  /** Si se pasa, la categoría recomendada trae un botón para elegirla (solo la elige la persona; nunca se cambia sola). */
  onUseCategory?: (canal: string, categoria: { id: string; ruta: string }) => void;
}

/**
 * Avisa, por canal, si las variantes del producto caben en UNA sola publicación según la categoría que tienen allí. Si no caben
 * (la categoría no admite variantes o no admite alguno de los ejes) dice que se publicarán como productos SEPARADOS, y ofrece
 * otra categoría que sí las admite. La categoría que manda es la que mejor encaja con el producto: esto solo la recomienda.
 */
/**
 * Cuando el canal no acepta un eje tal como se llama (por ejemplo «Talla» y Falabella pide «Tamaño cama»), deja renombrarlo a uno de los datos de
 * variante que el canal ofrece. Solo sale en ese caso: si todo encaja tal como se manda, no hay nada que cambiar.
 */
function RenombrarEje({ groupId, eje, opciones, sugerido }: { groupId: string; eje: string; opciones: string[]; sugerido?: string }) {
  const queryClient = useQueryClient();
  const { can } = useStores();
  const [nuevo, setNuevo] = useState(sugerido ?? (opciones.length === 1 ? opciones[0] : ""));
  const [otra, setOtra] = useState(false);
  const renombrar = useMutation({
    mutationFn: (a: string) => productsApi.renameGroupAxis(groupId, eje, a),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo renombrar el eje");
      toast.success(`Eje renombrado: «${eje}» ahora se llama «${res.data.eje}» en las ${res.data.variantes} variantes.`);
      queryClient.invalidateQueries({ queryKey: ["variant-compat"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-sheet"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });
  if (!can("productos.editar")) return null;
  return (
    <div className="space-y-1.5 pt-1 border-t border-amber-500/30">
      {sugerido && (
        <div className="space-y-1">
          <p className="break-words">Parece que «{eje}» es el <span className="font-medium">{sugerido}</span> que pide el canal. Solo confirma y se renombra (los valores no cambian):</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button type="button" size="sm" className="h-7 text-xs" disabled={renombrar.isPending} onClick={() => renombrar.mutate(sugerido)}>
              {renombrar.isPending ? "Renombrando…" : `Renombrar «${eje}» a «${sugerido}»`}
            </Button>
            {!otra && opciones.length > 1 && <button type="button" className="underline text-muted-foreground" onClick={() => setOtra(true)}>Elegir otro nombre</button>}
          </div>
        </div>
      )}
      {(!sugerido || otra) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="break-words">{sugerido ? "Renombrar a:" : `¿«${eje}» es lo mismo que uno de estos datos? Renómbralo para que coincida:`}</span>
          <select value={nuevo} onChange={(e) => setNuevo(e.target.value)} className="h-7 rounded-md border border-border bg-background px-2 text-xs">
            <option value="">Elige…</option>
            {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={!nuevo || renombrar.isPending} onClick={() => renombrar.mutate(nuevo)}>
            {renombrar.isPending ? "Renombrando…" : "Renombrar eje"}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Cuando un color, una talla o un tamaño que escribió la persona no existe en la lista del canal (o dos caen en la misma opción), la IA propone
 * la opción válida más cercana (por el nombre del producto y, si hace falta, mirando la foto de la variante). La persona revisa y confirma;
 * solo vale para ese canal: lo que escribió no cambia en Synkro ni en los demás canales.
 */
function ResolverValores({ groupId, canal, nombreDelCanal }: { groupId: string; canal: string; nombreDelCanal: string }) {
  const queryClient = useQueryClient();
  const { can } = useStores();
  const [propuestas, setPropuestas] = useState<SugerenciaDeAjustes[] | null>(null);
  const [elegidas, setElegidas] = useState<Record<string, string>>({});
  // Un eje puede tener varios datos del canal (Color y Color básico): cada uno se identifica aparte.
  const idDe = (p: SugerenciaDeAjustes) => (p.derivado ? p.eje + "#" + p.atributo : p.eje);
  const clave = (eje: string, valor: string) => `${eje}\u0000${valor}`;

  const sugerir = useMutation({
    mutationFn: () => productsApi.suggestChannelValues(groupId, canal),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo consultar a la IA");
      setPropuestas(res.data);
      setElegidas(Object.fromEntries(res.data.flatMap((p) => p.items.map((i) => [clave(idDe(p), i.valor), i.opcion ?? ""]))));
      if (!res.data.length) toast.info("No hay nada que resolver en este canal.");
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const aplicar = useMutation({
    mutationFn: () => productsApi.applyChannelValues(
      groupId, canal,
      (propuestas ?? []).flatMap((p) => p.items.map((i) => ({ eje: p.eje, valor: i.valor, opcion: elegidas[clave(idDe(p), i.valor)], ...(p.derivado ? { atributo: p.atributo } : {}) }))).filter((c) => !!c.opcion),
    ),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo guardar");
      toast.success(`Listo: ${res.data.aplicados} valor(es) ajustados para ${nombreDelCanal} en las ${res.data.variantes} variantes.`);
      setPropuestas(null);
      queryClient.invalidateQueries({ queryKey: ["variant-compat"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  if (!can("canales.publicar")) return null;
  const sinElegir = (propuestas ?? []).some((p) => p.items.some((i) => !elegidas[clave(idDe(p), i.valor)]));
  return (
    <div className="space-y-2 pt-1 border-t border-amber-500/30">
      {!propuestas?.length && (
        <div className="space-y-1">
          <p className="break-words">Que ningún valor quede sin opción: la IA propone la opción válida de {nombreDelCanal} más cercana a lo que escribiste. Tú confirmas; lo que escribiste no cambia.</p>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" disabled={sugerir.isPending} onClick={() => sugerir.mutate()}>
            <Sparkles className="w-3.5 h-3.5" /> {sugerir.isPending ? "Consultando a la IA…" : "Resolver con IA"}
          </Button>
        </div>
      )}
      {propuestas?.map((p) => (
        <div key={idDe(p)} className="space-y-1.5">
          <p className="font-medium">{p.eje} → {p.atributo.replace(/\s*variant$/i, "")} de {nombreDelCanal}</p>
          {p.items.map((i) => (
            <div key={i.valor} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 items-center">
              <span className="break-words">«{i.valor}»{i.conflicto && <span className="text-amber-700 dark:text-amber-400"> · repetida</span>}</span>
              <select
                value={elegidas[clave(idDe(p), i.valor)] ?? ""}
                onChange={(e) => setElegidas((x) => ({ ...x, [clave(idDe(p), i.valor)]: e.target.value }))}
                className="h-7 max-w-[11rem] rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="">Elige…</option>
                {p.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <span className="col-span-2 text-[11px] text-muted-foreground break-words">
                {i.origen === "foto" ? "Según la foto de esa variante · " : i.origen === "ia" ? "Por el nombre del producto · " : ""}{i.motivo}
              </span>
            </div>
          ))}
        </div>
      ))}
      {!!propuestas?.length && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button type="button" size="sm" className="h-7 text-xs" disabled={aplicar.isPending || sinElegir} onClick={() => aplicar.mutate()}>
            {aplicar.isPending ? "Guardando…" : "Confirmar y aplicar"}
          </Button>
          <button type="button" className="underline text-muted-foreground" onClick={() => setPropuestas(null)}>Cancelar</button>
          {sinElegir && <span className="text-[11px] text-muted-foreground">Elige una opción para cada valor.</span>}
        </div>
      )}
    </div>
  );
}


const ESTILO_DE_ESTADO: Record<EstadoDeValor, { texto: string; clase: string }> = {
  exacto: { texto: "Exacto", clase: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10" },
  ajustado: { texto: "Ajustado", clase: "text-sky-700 dark:text-sky-400 bg-sky-500/10" },
  aproximado: { texto: "Aproximado: revisa", clase: "text-amber-700 dark:text-amber-400 bg-amber-500/15" },
  sin: { texto: "Sin opción", clase: "text-red-700 dark:text-red-400 bg-red-500/10" },
};

/**
 * Siempre que el producto tenga variantes: qué opción del canal llevará cada color y cada talla (también el segundo dato de color, como «Color
 * básico», cuya lista es otra). Así la persona ve que todo quedó identificado, qué se aproximó y qué falta, sin esperar a que algo falle.
 * Cada fila se puede cambiar (solo vale para ese canal: lo que escribió no cambia).
 */
function ResumenDeValores({ groupId, r }: { groupId: string; r: VariantCompatResult }) {
  const queryClient = useQueryClient();
  const { can } = useStores();
  const cambiar = useMutation({
    mutationFn: (c: { eje: string; valor: string; opcion: string; atributo?: string }) => productsApi.applyChannelValues(groupId, r.canal, [c]),
    onSuccess: (res, c) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo guardar");
      toast.success(`«${c.valor}» saldrá como «${c.opcion}» en ${r.nombreDelCanal}.`);
      queryClient.invalidateQueries({ queryKey: ["variant-compat"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const detalle = (r.detalle ?? []).filter((d) => d.items.length > 0);
  const principales = detalle.filter((d) => !d.derivado);
  if (!principales.length) return null;
  // Se cuentan también los datos derivados (Color básico): si uno queda sin opción, las tallas de ese color saldrían distintas.
  const valores = detalle.flatMap((d) => d.items);
  const sin = valores.filter((i) => i.estado === "sin").length;
  const aprox = valores.filter((i) => i.estado === "aproximado").length;
  const todoBien = sin === 0 && aprox === 0;
  const editable = can("canales.publicar");

  return (
    <div className={`rounded-lg border p-2.5 text-xs space-y-2 min-w-0 ${sin ? "border-red-500/40 bg-red-500/5" : aprox ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
      <div className="space-y-0.5">
        <p className="font-medium flex items-center gap-1.5 break-words">
          {todoBien ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />}
          Cómo saldrán tus colores y tallas en {r.nombreDelCanal}
        </p>
        <p className="text-muted-foreground break-words">
          {valores.length - sin} de {valores.length} identificados
          {aprox > 0 && ` · ${aprox} aproximado${aprox === 1 ? "" : "s"}: revísalo${aprox === 1 ? "" : "s"}`}
          {sin > 0 && ` · ${sin} sin opción: elígela abajo`}
        </p>
      </div>

      {principales.map((p) => {
        const derivados = detalle.filter((d) => d.derivado && d.eje === p.eje);
        const detallado = p.items.some((i) => i.estado !== "exacto") || /color/i.test(p.eje);
        if (!detallado) {
          return (
            <p key={p.atributoId} className="break-words">
              <span className="font-medium">{p.eje}:</span> {p.items.map((i) => i.valor).join(", ")}{" "}
              <span className={`rounded px-1.5 py-0.5 text-[11px] ${ESTILO_DE_ESTADO.exacto.clase}`}>Todo exacto</span>
            </p>
          );
        }
        return (
          <div key={p.atributoId} className="space-y-1.5">
            <p className="font-medium">{p.eje} → {p.atributo} de {r.nombreDelCanal}</p>
            {p.items.map((i) => {
              const estilo = ESTILO_DE_ESTADO[i.estado];
              return (
                <div key={i.valor} className="space-y-0.5">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 items-center">
                    <span className="break-words">«{i.valor}»</span>
                    {editable ? (
                      <select
                        value={i.opcion ?? ""}
                        disabled={cambiar.isPending}
                        onChange={(e) => e.target.value && cambiar.mutate({ eje: p.eje, valor: i.valor, opcion: e.target.value })}
                        className="h-7 max-w-[11rem] rounded-md border border-border bg-background px-2 text-xs"
                      >
                        {!i.opcion && <option value="">Elige…</option>}
                        {p.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <span className="font-medium">{i.opcion ?? "—"}</span>
                    )}
                    <span className={`col-span-2 w-fit rounded px-1.5 py-0.5 text-[11px] inline-flex items-center gap-1 ${estilo.clase}`}>
                      {i.estado === "ajustado" && <Pencil className="w-3 h-3" />}{estilo.texto}
                    </span>
                  </div>
                  {derivados.map((d) => {
                    const hijo = d.items.find((x) => x.valor === i.valor);
                    const e = ESTILO_DE_ESTADO[hijo?.estado ?? "sin"];
                    return (
                      <div key={d.atributoId} className="flex items-center gap-2 flex-wrap pl-3 text-[11px] text-muted-foreground">
                        <span>{d.atributo}:</span>
                        {editable ? (
                          <select
                            value={hijo?.opcion ?? ""}
                            disabled={cambiar.isPending}
                            onChange={(ev) => ev.target.value && cambiar.mutate({ eje: p.eje, valor: i.valor, opcion: ev.target.value, atributo: d.atributo })}
                            className="h-6 max-w-[10rem] rounded-md border border-border bg-background px-1.5 text-[11px] text-foreground"
                          >
                            {!hijo?.opcion && <option value="">Elige…</option>}
                            {d.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <span className="font-medium text-foreground">{hijo?.opcion ?? "sin opción"}</span>
                        )}
                        {hijo && hijo.estado !== "exacto" && <span className={"rounded px-1.5 py-0.5 " + e.clase}>{e.texto}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function VariantCompatNotice({ groupId, marketplaces, categoryId, onUseCategory }: Props) {
  const canales = marketplaces.filter((m) => CANALES_REVISABLES.includes(m));
  const { data } = useQuery({
    queryKey: ["variant-compat", groupId, canales.join(","), canales.length === 1 ? categoryId : null],
    queryFn: () => productsApi.variantCompat(groupId, canales, canales.length === 1 ? categoryId : undefined),
    enabled: !!groupId && canales.length > 0,
    staleTime: 60_000,
  });
  const resultados = (data?.data ?? []).filter((r) => r.avisos.length > 0 || r.publicaComo === "separadas" || (r.detalle?.length ?? 0) > 0);
  if (!resultados.length) return null;

  return (
    <div className="space-y-2 min-w-0">
      {resultados.map((r) => {
        const separadas = r.publicaComo === "separadas";
        const hayAviso = r.avisos.length > 0 || separadas;
        return (
          <div key={r.canal} className="space-y-2 min-w-0">
          {hayAviso && <div className={`rounded-lg border p-2.5 text-xs space-y-1.5 min-w-0 ${separadas ? "border-amber-500/40 bg-amber-500/10" : "border-border text-muted-foreground"}`}>
            <p className="font-medium flex items-center gap-1.5">
              {separadas ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <Info className="w-3.5 h-3.5 shrink-0" />}
              {r.nombreDelCanal}: {separadas ? "se publicarán como productos separados" : "revisa estos detalles"}
            </p>
            {r.avisos.map((a, i) => <p key={i} className="break-words">{a}</p>)}
            {(r.valoresSinEquivalente.length > 0 || (r.colisiones?.length ?? 0) > 0 || (r.detalle ?? []).some((d) => d.items.some((i) => i.estado === "sin"))) && <ResolverValores groupId={groupId} canal={r.canal} nombreDelCanal={r.nombreDelCanal} />}
            {separadas && (r.ejesDisponibles?.length ?? 0) > 0 && r.ejesNoPermitidos.map((eje) => <RenombrarEje key={eje} groupId={groupId} eje={eje} opciones={r.ejesDisponibles!} sugerido={r.renombresSugeridos?.find((s) => s.eje === eje)?.a} />)}
            {separadas && r.recomendada && (
              <div className="flex items-start gap-1.5 pt-1 border-t border-amber-500/30">
                <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="break-words">
                    Si quieres publicarlas juntas, esta categoría de {r.nombreDelCanal} sí acepta tus variantes: <span className="font-medium">{r.recomendada.ruta}</span>.
                    La categoría que mejor encaja con tu producto sigue siendo la elegida; esta es solo una recomendación.
                  </p>
                  {onUseCategory && (
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs mt-1.5" onClick={() => onUseCategory(r.canal, r.recomendada!)}>
                      Usar esta categoría
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>}
          <ResumenDeValores groupId={groupId} r={r} />
          </div>
        );
      })}
    </div>
  );
}
