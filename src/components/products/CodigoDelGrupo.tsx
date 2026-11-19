import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productsApi } from "@/lib/products-api";
import { useStores } from "@/contexts/StoreContext";

/**
 * El código del grupo es el que los canales reciben como identificador de la familia de variantes. Si coincide con el SKU de otro producto,
 * los canales los mezclan en una sola ficha. Aquí se puede cambiar por uno libre (los SKU de las variantes no cambian) y no envía nada a ningún canal.
 */
export function CodigoDelGrupo({ groupId, codigo }: { groupId: string; codigo: string }) {
  const queryClient = useQueryClient();
  const { can } = useStores();
  const [editando, setEditando] = useState(false);
  const [nuevo, setNuevo] = useState("");

  const cambiar = useMutation({
    mutationFn: () => productsApi.changeGroupCode(groupId, nuevo.trim() || undefined),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo cambiar el código");
      toast.success(`Código del grupo: ${res.data.anterior} → ${res.data.nuevo}. No se envió nada a los canales${res.data.canales.length ? `; para que ${res.data.canales.join(", ")} lo reciba hay que reenviar el grupo` : ""}.`);
      setEditando(false);
      setNuevo("");
      for (const k of ["products", "product-sheet", "sync-status", "products-overview"]) queryClient.invalidateQueries({ queryKey: [k] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  return (
    <div className="rounded-lg border border-border p-3 text-xs space-y-2">
      <p className="break-words"><span className="text-muted-foreground">Código del grupo:</span> <code className="font-mono">{codigo}</code></p>
      {can("productos.editar") && (editando ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input className="h-8 w-48 text-xs" value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Vacío = el siguiente libre" />
          <Button type="button" size="sm" className="h-8 text-xs" disabled={cambiar.isPending} onClick={() => cambiar.mutate()}>
            {cambiar.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}Cambiar código
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditando(false)}>Cancelar</Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditando(true)}>Cambiar código del grupo</Button>
      ))}
    </div>
  );
}
