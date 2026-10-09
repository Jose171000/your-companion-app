import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Store } from "lucide-react";
import { storesApi } from "@/lib/stores-api";
import { channelName } from "@/components/marketplaces/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; className: string }> = {
  published: { label: "Publicadas", className: "bg-green-500/10 text-green-400 border-green-500/30" },
  pending: { label: "En proceso", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  paused: { label: "Pausadas", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  error: { label: "Con error", className: "bg-red-500/10 text-red-400 border-red-500/30" },
};

/**
 * Información general de una tienda, visible sin iniciar sesión.
 * Para ver más o hacer cambios hay que entrar y tener acceso a la tienda.
 */
export default function PublicStore() {
  const { token = "" } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["public-store", token],
    queryFn: () => storesApi.publicSummary(token),
    retry: false,
  });

  const store = data?.data;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex items-center gap-3">
          <img src="/logo_synkro.png" alt="Synkro" className="h-8 w-auto" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
        ) : !store ? (
          <div className="glass rounded-2xl p-8 text-center space-y-2">
            <Store className="w-10 h-10 mx-auto text-muted-foreground opacity-50" />
            <h1 className="text-lg font-semibold">Este enlace no está disponible</h1>
            <p className="text-sm text-muted-foreground">Puede que el dueño lo haya desactivado o que el enlace sea incorrecto.</p>
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Tienda</p>
              <h1 className="text-2xl font-bold tracking-tight">{store.name}</h1>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/30 p-4">
                <p className="text-3xl font-semibold tabular-nums">{store.publications}</p>
                <p className="text-xs text-muted-foreground">Publicaciones</p>
              </div>
              <div className="rounded-xl bg-secondary/30 p-4">
                <p className="text-3xl font-semibold tabular-nums">
                  {store.averageQuality != null ? `${store.averageQuality}/100` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Calidad media de fichas</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Estado de las publicaciones</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(store.byStatus).length === 0 && <span className="text-sm text-muted-foreground">Aún no hay publicaciones.</span>}
                {Object.entries(store.byStatus).map(([estado, n]) => {
                  const s = STATUS[estado] ?? { label: estado, className: "" };
                  return <Badge key={estado} className={cn("text-xs", s.className)}>{s.label}: {n}</Badge>;
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Canales conectados</p>
              <div className="flex flex-wrap gap-2">
                {store.channels.length === 0 && <span className="text-sm text-muted-foreground">Ninguno todavía.</span>}
                {store.channels.map((c) => <Badge key={c} variant="secondary">{channelName(c)}</Badge>)}
              </div>
            </div>

            <p className="text-xs text-muted-foreground border-t border-border pt-4">
              ¿Eres parte del equipo? <a href="/login" className="text-primary hover:underline">Inicia sesión</a> para ver el detalle y gestionar la tienda.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
