import { useQueries, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncApi } from "@/lib/sync-api";
import { useStores } from "@/contexts/StoreContext";

/**
 * La categoría de Falabella se guarda en cada variante: en un grupo pueden quedar variantes sin categoría o con categorías distintas.
 * Este aviso lo dice y deja dar la categoría a las que faltan. Solo toca las que no tienen ninguna: las ya publicadas conservan la
 * categoría de su ficha en Falabella. No envía nada al canal.
 */
export function CategoriaDelGrupo({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const { can } = useStores();

  const { data } = useQuery({
    queryKey: ["falabella-group-category", groupId],
    queryFn: () => syncApi.getFalabellaGroupCategoryStatus(groupId),
    staleTime: 30_000,
  });
  const estado = data?.data;

  const ids = [...new Set([...(estado?.categorias.map((c) => c.id) ?? []), ...(estado?.recomendada ? [estado.recomendada] : [])])];
  const nombres = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["falabella-category-check", id],
      queryFn: () => syncApi.describeFalabellaCategory(id),
      staleTime: 10 * 60_000,
    })),
  });
  const nombreDe = (id: string) => {
    const i = ids.indexOf(id);
    const r = nombres[i]?.data?.data;
    return r?.valida && r.path ? r.path : `categoría ${id}${r && !r.valida ? " (ya no existe en Falabella)" : ""}`;
  };

  const completar = useMutation({
    mutationFn: () => syncApi.completeFalabellaGroupCategory(groupId),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo asignar la categoría");
      const n = res.data.asignadas + res.data.igualadas;
      toast.success(`Categoría unificada en ${n} variante(s).${res.data.distintasPublicadas ? ` ${res.data.distintasPublicadas} ya publicada(s) con otra conservan la de su ficha en Falabella.` : ""} No se envió nada a Falabella.`);
      for (const k of ["falabella-group-category", "products", "product-sheet", "sync-status", "variant-compat"]) queryClient.invalidateQueries({ queryKey: [k] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  if (!estado || (!estado.sinCategoria.length && !estado.mezcladas)) return null;
  const faltan = estado.sinCategoria.length;
  const porAlinear = estado.porAsignar + estado.porIgualar;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2">
      <p className="break-words">Un producto con variantes debe tener <span className="font-medium">una sola categoría</span> para todas sus variantes.{faltan > 0 && <> {faltan} de las {estado.variantes} no tienen ninguna.</>}</p>
      {porAlinear > 0 && (estado.recomendada && can("canales.publicar") ? (
        <Button type="button" size="sm" className="h-7 text-xs h-auto min-h-7 whitespace-normal text-left" disabled={completar.isPending} onClick={() => completar.mutate()}>
          {completar.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
          Dejar {porAlinear} variante(s) con: {nombreDe(estado.recomendada)}
        </Button>
      ) : (
        <p className="text-muted-foreground">Elige una categoría en «Preparar para Falabella».</p>
      ))}
      {estado.mezcladas && (
        <div className="space-y-1">
          <p className="font-medium">Las variantes de este grupo usan categorías distintas en Falabella:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {estado.categorias.map((c) => (
              <li key={c.id} className="break-words">{nombreDe(c.id)} — {c.total} variante(s){c.publicadas ? `, ${c.publicadas} ya en Falabella` : ""}</li>
            ))}
          </ul>
          <p className="text-muted-foreground">{estado.distintasPublicadas > 0 ? `${estado.distintasPublicadas} variante(s) ya publicada(s) tienen otra y conservan la de su ficha en Falabella (el canal no deja cambiarla desde aquí). ` : ""}Las que no se han enviado se alinean con el botón.</p>
        </div>
      )}
    </div>
  );
}
