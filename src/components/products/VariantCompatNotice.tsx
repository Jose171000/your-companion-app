import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { productsApi } from "@/lib/products-api";

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
export function VariantCompatNotice({ groupId, marketplaces, categoryId, onUseCategory }: Props) {
  const canales = marketplaces.filter((m) => CANALES_REVISABLES.includes(m));
  const { data } = useQuery({
    queryKey: ["variant-compat", groupId, canales.join(","), canales.length === 1 ? categoryId : null],
    queryFn: () => productsApi.variantCompat(groupId, canales, canales.length === 1 ? categoryId : undefined),
    enabled: !!groupId && canales.length > 0,
    staleTime: 60_000,
  });
  const resultados = (data?.data ?? []).filter((r) => r.avisos.length > 0 || r.publicaComo === "separadas");
  if (!resultados.length) return null;

  return (
    <div className="space-y-2 min-w-0">
      {resultados.map((r) => {
        const separadas = r.publicaComo === "separadas";
        return (
          <div key={r.canal} className={`rounded-lg border p-2.5 text-xs space-y-1.5 min-w-0 ${separadas ? "border-amber-500/40 bg-amber-500/10" : "border-border text-muted-foreground"}`}>
            <p className="font-medium flex items-center gap-1.5">
              {separadas ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <Info className="w-3.5 h-3.5 shrink-0" />}
              {r.nombreDelCanal}: {separadas ? "se publicarán como productos separados" : "revisa estos detalles"}
            </p>
            {r.avisos.map((a, i) => <p key={i} className="break-words">{a}</p>)}
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
          </div>
        );
      })}
    </div>
  );
}
