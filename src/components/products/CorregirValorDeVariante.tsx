import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { productsApi, type SugerenciaDeAjustes } from "@/lib/products-api";
import { useStores } from "@/contexts/StoreContext";

interface Props {
  groupId: string;
  /** Canal que rechazó la variante (mercadolibre, falabella). */
  canal: string;
  nombreDelCanal: string;
  /** Los valores de ESTA variante (Color: Coral…): solo se corrigen estos, no el resto del grupo. */
  variantValues: Record<string, string>;
  /** Se llama cuando el ajuste quedó guardado, para reenviar la variante. */
  onApplied: () => void;
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const clave = (id: string, valor: string) => `${id}\u0000${valor}`;
const idDe = (p: SugerenciaDeAjustes) => (p.derivado ? p.eje + "#" + p.atributo : p.eje);

/**
 * Una variante que el canal rechazó porque un color o una talla no está en su lista: propone, SOLO para el valor de esa variante,
 * la opción válida más cercana (la IA mira el nombre y la foto). La persona confirma; el ajuste vale solo para ese canal y no cambia
 * lo escrito en Synkro ni en los demás canales.
 */
export function CorregirValorDeVariante({ groupId, canal, nombreDelCanal, variantValues, onApplied }: Props) {
  const queryClient = useQueryClient();
  const { can } = useStores();
  const [propuestas, setPropuestas] = useState<SugerenciaDeAjustes[] | null>(null);
  const [elegidas, setElegidas] = useState<Record<string, string>>({});
  const [sinNada, setSinNada] = useState(false);

  const sugerir = useMutation({
    mutationFn: () => productsApi.suggestChannelValues(groupId, canal),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo consultar a la IA");
      // Solo lo de esta variante: el resto del grupo no falló.
      const suyas = res.data
        .map((p) => ({ ...p, items: p.items.filter((i) => norm(variantValues[p.eje]) === norm(i.valor)) }))
        .filter((p) => p.items.length);
      setSinNada(!suyas.length);
      setPropuestas(suyas);
      setElegidas(Object.fromEntries(suyas.flatMap((p) => p.items.map((i) => [clave(idDe(p), i.valor), i.opcion ?? ""]))));
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const aplicar = useMutation({
    mutationFn: () =>
      productsApi.applyChannelValues(
        groupId,
        canal,
        (propuestas ?? [])
          .flatMap((p) => p.items.map((i) => ({ eje: p.eje, valor: i.valor, opcion: elegidas[clave(idDe(p), i.valor)], ...(p.derivado ? { atributo: p.atributo } : {}) })))
          .filter((c) => !!c.opcion),
      ),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo guardar");
      toast.success(`Listo: el valor quedó ajustado para ${nombreDelCanal}. Reenviando…`);
      setPropuestas(null);
      queryClient.invalidateQueries({ queryKey: ["variant-compat"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onApplied();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  if (!can("canales.publicar")) return null;
  const sinElegir = (propuestas ?? []).some((p) => p.items.some((i) => !elegidas[clave(idDe(p), i.valor)]));

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2">
      {!propuestas && (
        <>
          <p className="break-words">{nombreDelCanal} rechazó esta variante. Si es por su color o talla, la IA propone la opción válida más cercana solo para ese valor.</p>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" disabled={sugerir.isPending} onClick={() => sugerir.mutate()}>
            <Sparkles className="w-3.5 h-3.5" /> {sugerir.isPending ? "Consultando a la IA…" : "Corregir con IA"}
          </Button>
        </>
      )}
      {propuestas && sinNada && (
        <p className="break-words">No encontré un color o talla de esta variante que explique el error en {nombreDelCanal}: puede ser otro dato. Revisa el mensaje del canal.</p>
      )}
      {propuestas?.map((p) => (
        <div key={idDe(p)} className="space-y-1.5">
          <p className="font-medium break-words">{p.eje} → {p.atributo.replace(/\s*variant$/i, "")} de {nombreDelCanal}</p>
          {p.items.map((i) => (
            <div key={i.valor} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 items-center">
              <span className="break-words">«{i.valor}» no está en la lista de {nombreDelCanal}</span>
              <select
                value={elegidas[clave(idDe(p), i.valor)] ?? ""}
                onChange={(e) => setElegidas((x) => ({ ...x, [clave(idDe(p), i.valor)]: e.target.value }))}
                className="h-7 max-w-[11rem] rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="">Elige…</option>
                {p.opciones.map((o) => <option key={o} value={o}>{o}{o === i.opcion ? " (recomendada)" : ""}</option>)}
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
            {aplicar.isPending ? "Guardando…" : "Aplicar y reenviar"}
          </Button>
          <button type="button" className="underline text-muted-foreground" onClick={() => setPropuestas(null)}>Cancelar</button>
          {sinElegir && <span className="text-[11px] text-muted-foreground">Elige una opción.</span>}
        </div>
      )}
      {propuestas && sinNada && <button type="button" className="underline text-muted-foreground" onClick={() => setPropuestas(null)}>Cerrar</button>}
    </div>
  );
}
