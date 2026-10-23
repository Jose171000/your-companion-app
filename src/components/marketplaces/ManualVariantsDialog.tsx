import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FalabellaImportSummary, syncApi } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Familia = NonNullable<NonNullable<FalabellaImportSummary["variantes"]>["sinResolver"]>[number];

interface Props {
  familia: Familia | null;
  onClose: () => void;
  /** Tras agrupar, para volver a leer la vista previa. */
  onDone: () => void;
}

/** Último recurso: la persona define el nombre, los ejes y el valor de cada SKU. La IA, si propuso algo, lo deja prellenado. */
export function ManualVariantsDialog({ familia, onClose, onDone }: Props) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [ejes, setEjes] = useState<string[]>(["Color"]);
  const [valores, setValores] = useState<Record<string, Record<string, string>>>({});

  const fichas = useMemo(() => familia?.fichas ?? familia?.skus.map((sku) => ({ sku, nombre: "", imagen: null as string | null })) ?? [], [familia]);

  useEffect(() => {
    if (!familia) return;
    setNombre(familia.fichas?.[0]?.nombre ?? familia.parentSku);
    const sugeridos = familia.sugerencia?.ejes?.filter(Boolean) ?? [];
    setEjes(sugeridos.length ? sugeridos.slice(0, 3) : ["Color"]);
    setValores(familia.sugerencia?.valores ?? {});
  }, [familia]);

  const guardar = useMutation({
    mutationFn: () =>
      syncApi.groupFalabellaVariants({
        parentSku: familia!.parentSku,
        name: nombre.trim(),
        axes: ejes.map((e) => e.trim()),
        variants: fichas.map((f) => ({ sellerSku: f.sku, values: Object.fromEntries(ejes.map((e) => [e.trim(), (valores[f.sku]?.[e] ?? "").trim()])) })),
      }),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Variantes agrupadas");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
      onDone();
      onClose();
    },
    onError: () => toast.error("No se pudo agrupar. Inténtalo de nuevo."),
  });

  const ejesValidos = ejes.every((e) => e.trim()) && new Set(ejes.map((e) => e.trim().toLowerCase())).size === ejes.length;
  const completo = ejesValidos && !!nombre.trim() && fichas.every((f) => ejes.every((e) => (valores[f.sku]?.[e] ?? "").trim()));

  const cambiarEje = (i: number, nuevo: string) => {
    const anterior = ejes[i];
    setEjes((prev) => prev.map((e, j) => (j === i ? nuevo : e)));
    // El valor ya escrito sigue a su eje aunque se cambie el nombre del eje.
    setValores((prev) => Object.fromEntries(Object.entries(prev).map(([sku, v]) => [sku, Object.fromEntries(Object.entries(v).map(([k, x]) => [k === anterior ? nuevo : k, x]))])));
  };

  return (
    <Dialog open={!!familia} onOpenChange={(abierto) => !abierto && !guardar.isPending && onClose()}>
      <DialogContent className="sm:max-w-[760px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estructurar variantes</DialogTitle>
          <DialogDescription>
            Familia {familia?.parentSku}: {fichas.length} productos. Define en qué se diferencian y el valor de cada uno. Las fotos, el precio y el stock de cada variante no cambian.
          </DialogDescription>
        </DialogHeader>

        {familia?.sugerencia && (
          <p className="text-xs text-yellow-400">
            La IA propuso estos valores pero no se pudieron comprobar en los datos de cada ficha ({familia.sugerencia.motivo}). Revísalos antes de guardar.
          </p>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre del producto</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={250} />
          </div>

          <div className="space-y-1.5">
            <Label>En qué se diferencian (eje de variación)</Label>
            <div className="flex flex-wrap gap-2 items-center">
              {ejes.map((e, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input className="w-36" value={e} onChange={(ev) => cambiarEje(i, ev.target.value)} placeholder="Color, Talla…" maxLength={50} />
                  {ejes.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => setEjes((prev) => prev.filter((_, j) => j !== i))} aria-label="Quitar eje">×</Button>
                  )}
                </div>
              ))}
              {ejes.length < 3 && (
                <Button variant="outline" size="sm" onClick={() => setEjes((prev) => [...prev, ""])}>+ Otro eje</Button>
              )}
            </div>
            {!ejesValidos && <p className="text-xs text-red-400">Cada eje necesita un nombre distinto.</p>}
          </div>

          <div className="rounded-lg border border-border divide-y divide-border/50">
            <div className="grid gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground" style={{ gridTemplateColumns: `minmax(0,1.6fr) repeat(${ejes.length}, minmax(0,1fr))` }}>
              <span>Producto</span>
              {ejes.map((e, i) => <span key={i}>{e || "Eje"}</span>)}
            </div>
            {fichas.map((f) => (
              <div key={f.sku} className="grid gap-2 px-3 py-2 items-center" style={{ gridTemplateColumns: `minmax(0,1.6fr) repeat(${ejes.length}, minmax(0,1fr))` }}>
                <div className="min-w-0 flex items-center gap-3">
                  {f.imagen ? (
                    <a href={f.imagen} target="_blank" rel="noreferrer" title="Ver la foto completa" className="shrink-0">
                      <img src={f.imagen} alt={f.sku} loading="lazy" className="w-16 h-16 rounded-lg object-cover border border-border bg-secondary/40" />
                    </a>
                  ) : (
                    <div className="w-16 h-16 rounded-lg border border-dashed border-border shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">Sin foto</div>
                  )}
                  <div className="min-w-0">
                    <code className="text-[11px] font-mono">{f.sku}</code>
                    {f.nombre && <p className="text-[11px] text-muted-foreground line-clamp-2" title={f.nombre}>{f.nombre}</p>}
                  </div>
                </div>
                {ejes.map((e, i) => (
                  <Input
                    key={i}
                    value={valores[f.sku]?.[e] ?? ""}
                    onChange={(ev) => setValores((prev) => ({ ...prev, [f.sku]: { ...(prev[f.sku] ?? {}), [e]: ev.target.value } }))}
                    placeholder={e || "Valor"}
                    maxLength={60}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardar.isPending}>Cancelar</Button>
          <Button onClick={() => guardar.mutate()} disabled={!completo || guardar.isPending}>
            {guardar.isPending ? "Agrupando…" : "Agrupar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
