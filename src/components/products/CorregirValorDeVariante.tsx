import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { productsApi } from "@/lib/products-api";
import { useStores } from "@/contexts/StoreContext";
import { cn } from "@/lib/utils";

interface Props {
  /** La variante que el canal rechazó. */
  productId: string;
  /** Canal que la rechazó (mercadolibre, falabella). */
  canal: string;
  nombreDelCanal: string;
  /** Se llama cuando el ajuste quedó guardado, para reenviar la variante. */
  onApplied: () => void;
}

const clave = (atributo: string, valor: string) => `${atributo}\u0000${valor}`;

/**
 * Una variante que el canal rechazó porque un dato de lista cerrada (color, talla…) tiene un valor que no está en su lista. Al aparecer,
 * la IA busca sola el dato rechazado y propone la opción válida (mirando el nombre y la foto). Si no puede, se muestran ahí mismo las
 * opciones que el canal SÍ acepta para elegir. La persona confirma; el ajuste vale solo para ese canal y no cambia lo escrito en Synkro
 * ni en los demás canales.
 */
export function CorregirValorDeVariante({ productId, canal, nombreDelCanal, onApplied }: Props) {
  const queryClient = useQueryClient();
  const { can } = useStores();
  const [elegidas, setElegidas] = useState<Record<string, string>>({});

  const sugerir = useMutation({
    mutationFn: () => productsApi.suggestChannelFix(productId, canal),
    onSuccess: (res) => {
      if (res.data) setElegidas(Object.fromEntries(res.data.items.map((i) => [clave(i.atributo, i.valor), i.opcion ?? ""])));
    },
  });

  // Se consulta sola al aparecer el error: no hace falta pulsar nada.
  useEffect(() => {
    sugerir.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, canal]);

  const items = sugerir.data?.data?.items ?? [];

  const aplicar = useMutation({
    mutationFn: () =>
      productsApi.applyChannelFix(
        productId,
        canal,
        items.map((i) => ({ atributo: i.atributo, valor: i.valor, opcion: elegidas[clave(i.atributo, i.valor)] })).filter((c) => !!c.opcion),
      ),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo guardar");
      toast.success(`Listo: el valor quedó ajustado para ${nombreDelCanal}. Reenviando…`);
      queryClient.invalidateQueries({ queryKey: ["variant-compat"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onApplied();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  if (!can("canales.publicar")) return null;
  const sinElegir = items.some((i) => !elegidas[clave(i.atributo, i.valor)]);

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-3">
      {sugerir.isPending && (
        <p className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> La IA está buscando la opción que {nombreDelCanal} sí acepta…</p>
      )}
      {(sugerir.isError || sugerir.data?.error) && (
        <div className="space-y-1.5">
          <p className="break-words">{sugerir.data?.error ?? "No se pudo consultar a la IA."}</p>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => sugerir.mutate()}><Sparkles className="w-3.5 h-3.5" /> Reintentar</Button>
        </div>
      )}
      {sugerir.isSuccess && !sugerir.data?.error && !items.length && (
        <p className="break-words">No encontré un dato de lista cerrada con un valor rechazado en esta variante: el error puede ser de otro dato. Revisa el mensaje del canal.</p>
      )}
      {items.map((i) => {
        const k = clave(i.atributo, i.valor);
        const elegida = elegidas[k] ?? "";
        return (
          <div key={k} className="space-y-1.5">
            <p className="break-words">
              <span className="font-medium">{i.atributo.replace(/\s*variant$/i, "")}</span>: «{i.valor}» no está en la lista de {nombreDelCanal}.{" "}
              {i.opcion
                ? <span>La IA recomienda <span className="font-medium">{i.opcion}</span>. {i.origen === "foto" ? "Según la foto de esa variante · " : i.origen === "ia" ? "Por el nombre del producto · " : ""}{i.motivo}</span>
                : <span>{i.motivo}</span>}
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {i.opciones.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setElegidas((x) => ({ ...x, [k]: o }))}
                  className={cn(
                    "px-2 py-1 rounded-md border text-[11px] transition-colors",
                    elegida === o ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-secondary/60",
                    o === i.opcion && elegida !== o && "border-primary/60",
                  )}
                >
                  {o}{o === i.opcion ? " ★" : ""}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {!!items.length && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button type="button" size="sm" className="h-7 text-xs" disabled={aplicar.isPending || sinElegir} onClick={() => aplicar.mutate()}>
            {aplicar.isPending ? "Guardando…" : "Aplicar y reenviar"}
          </Button>
          {sinElegir && <span className="text-[11px] text-muted-foreground">Elige una de las opciones que acepta {nombreDelCanal}.</span>}
        </div>
      )}
    </div>
  );
}
