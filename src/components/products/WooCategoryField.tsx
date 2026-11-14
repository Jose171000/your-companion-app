import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { syncApi } from "@/lib/sync-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCircle, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const MAX_VISIBLES = 100;
const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * La categoría de WooCommerce del producto: Synkro la elige sola entre las categorías reales de la tienda (por texto o con IA) y aquí
 * se ve cuál es. Se puede cambiar buscando en la lista de la tienda, que puede tener cientos de categorías. Nunca se crea una.
 */
export function WooCategoryField({ productId, connectionId }: { productId: string; connectionId?: string }) {
  const queryClient = useQueryClient();
  const clave = ["woo-categoria", productId, connectionId ?? "unica"];
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  // Consultar la elegida no cambia nada: si todavía no hay, Synkro la elige sola ahora.
  const elegida = useQuery({
    queryKey: clave,
    queryFn: async () => {
      const res = await syncApi.wooCategory(productId, { connectionId });
      if (res.error || !res.data) throw new Error(res.error ?? "No se pudo elegir la categoría");
      return res.data;
    },
    retry: false,
    staleTime: 60_000,
  });

  const lista = useQuery({
    queryKey: ["woo-categorias", connectionId ?? "unica"],
    queryFn: async () => {
      const res = await syncApi.wooCategories(connectionId);
      if (res.error || !res.data) throw new Error(res.error ?? "No se pudieron leer las categorías de la tienda");
      return res.data;
    },
    enabled: abierto,
    staleTime: 5 * 60_000,
  });

  const filtradas = useMemo(() => {
    const todas = lista.data ?? [];
    const k = sinTildes(busqueda.trim());
    const coinciden = k ? todas.filter((c) => sinTildes(c.ruta).includes(k)) : todas;
    return { total: coinciden.length, visibles: coinciden.slice(0, MAX_VISIBLES) };
  }, [lista.data, busqueda]);

  useEffect(() => { if (!abierto) setBusqueda(""); }, [abierto]);

  const cambiar = useMutation({
    mutationFn: async (categoryId: number) => {
      const res = await syncApi.wooCategory(productId, { connectionId, categoryId });
      if (res.error || !res.data) throw new Error(res.error ?? "No se pudo cambiar la categoría");
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(clave, data);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-sheet"] });
      setAbierto(false);
      toast.success(data.actualizadosEnWoo ? "Categoría cambiada en WooCommerce" : "Categoría guardada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const origen = elegida.data?.origen;
  return (
    <div className="rounded-xl border border-border p-3 space-y-2 min-w-0">
      <p className="text-sm font-medium flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-primary" /> Categoría en WooCommerce
      </p>

      {elegida.isLoading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Eligiendo la categoría de tu tienda…</p>
      ) : elegida.isError ? (
        <p className="text-xs text-amber-500 break-words flex gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{(elegida.error as Error).message}</p>
      ) : (
        <p className="text-sm break-words">
          {elegida.data?.categoria.ruta}{" "}
          {origen === "manual"
            ? <Badge className="ml-1 bg-secondary text-muted-foreground text-[10px]">Elegida por ti</Badge>
            : <Badge className="ml-1 bg-primary/10 text-primary text-[10px]">{origen === "ia" ? "Elegida por la IA" : "Elegida por Synkro"}</Badge>}
        </p>
      )}
      {elegida.data?.motivo && origen === "ia" && <p className="text-[11px] text-muted-foreground break-words">{elegida.data.motivo}</p>}

      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs">Cambiar categoría</Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(420px,90vw)] p-2 space-y-2">
          <Input autoFocus placeholder="Busca entre las categorías de tu tienda…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="h-8 text-xs" />
          {lista.isLoading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 p-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Leyendo las categorías de la tienda…</p>
          ) : lista.isError ? (
            <p className="text-xs text-red-400 p-1 break-words">{(lista.error as Error).message}</p>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {filtradas.visibles.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={cambiar.isPending}
                    onClick={() => cambiar.mutate(c.id)}
                    className="w-full text-left text-xs rounded-md px-2 py-1.5 hover:bg-accent flex items-start gap-1.5 break-words"
                  >
                    <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${elegida.data?.categoria.id === c.id ? "opacity-100" : "opacity-0"}`} />
                    <span>{c.ruta}</span>
                  </button>
                ))}
                {filtradas.total === 0 && <p className="text-xs text-muted-foreground p-2">Ninguna categoría coincide.</p>}
              </div>
              {filtradas.total > MAX_VISIBLES && (
                <p className="text-[11px] text-muted-foreground px-1">Se muestran {MAX_VISIBLES} de {filtradas.total}: escribe más para acotar.</p>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
