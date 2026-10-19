import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { syncApi } from "@/lib/sync-api";

const NOMBRE: Record<string, string> = { falabella: "Falabella", mercadolibre: "Mercado Libre" };

/**
 * El estado real de la publicación en cada canal. «Publicando» solo significa que el envío salió: el canal
 * lo revisa después y puede tardar. Aquí se ve cuándo queda publicado o con qué motivo lo rechazan.
 */
export function LaunchStatus({ productId }: { productId: string }) {
  const { data } = useQuery({
    queryKey: ["launch-status", productId],
    queryFn: () => syncApi.getProductStatus(productId),
    // Mientras algún canal sigue procesando se vuelve a mirar; al terminar todos, se detiene.
    refetchInterval: (query) => {
      const listings = (query.state.data as any)?.data?.listings as { syncStatus: string }[] | undefined;
      return !listings || listings.some((l) => l.syncStatus === "pending") ? 8_000 : false;
    },
  });
  const listings = data?.data?.listings ?? [];
  if (!listings.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Estado en cada canal</p>
      {listings.map((l) => (
        <div key={`${l.marketplace}-${l.externalId}`} className="text-sm break-words">
          {l.syncStatus === "published" ? (
            <p className="text-green-500 flex items-start gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {NOMBRE[l.marketplace] ?? l.marketplace}: publicado.{" "}
                {l.permalink && (
                  <a href={l.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
                    Ver publicación <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </span>
            </p>
          ) : l.syncStatus === "error" ? (
            <p className="text-red-400 flex items-start gap-1.5">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{NOMBRE[l.marketplace] ?? l.marketplace}: {l.lastError || "no se pudo publicar"}</span>
            </p>
          ) : (
            <p className="text-amber-500 flex items-start gap-1.5">
              <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
              <span>
                {NOMBRE[l.marketplace] ?? l.marketplace}: enviado, esperando que el canal lo procese. Puede tardar de minutos a horas; puedes seguir con otro producto o cerrar esta pantalla.
              </span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
