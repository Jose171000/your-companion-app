import { useEffect, useMemo, useState } from "react";
import { FalabellaImportSummary, GrupoManual } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Familia = NonNullable<NonNullable<FalabellaImportSummary["variantes"]>["sinResolver"]>[number];

interface Props {
  familia: Familia | null;
  /** Lo que la persona ya estructuró de esta familia (para editarlo), si lo hay. */
  guardado?: GrupoManual | null;
  onClose: () => void;
  /** Al pulsar «Agrupar»: la estructura queda anotada y se aplica en la importación, junto con la creación de los productos. */
  onGuardar: (grupo: GrupoManual) => void;
}

/**
 * Último recurso: la persona define el nombre, los ejes y el valor de cada SKU. La IA, si propuso algo, lo deja prellenado.
 * Los productos todavía no existen en la tienda (la importación los crea), así que aquí no se guarda nada en el servidor: se anota
 * la estructura y se agrupa en el mismo paso que la importación.
 */
export function ManualVariantsDialog({ familia, guardado, onClose, onGuardar }: Props) {
  const [nombre, setNombre] = useState("");
  const [ejes, setEjes] = useState<string[]>(["Color"]);
  const [valores, setValores] = useState<Record<string, Record<string, string>>>({});

  const fichas = useMemo(() => familia?.fichas ?? familia?.skus.map((sku) => ({ sku, nombre: "", imagen: null as string | null })) ?? [], [familia]);

  useEffect(() => {
    if (!familia) return;
    if (guardado) {
      setNombre(guardado.name);
      setEjes(guardado.axes);
      setValores(Object.fromEntries(guardado.variants.map((v) => [v.sellerSku, v.values])));
      return;
    }
    setNombre(familia.fichas?.[0]?.nombre ?? familia.parentSku);
    const sugeridos = familia.sugerencia?.ejes?.filter(Boolean) ?? [];
    setEjes(sugeridos.length ? sugeridos.slice(0, 3) : ["Color"]);
    setValores(familia.sugerencia?.valores ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familia, guardado]);

  const ejesValidos = ejes.every((e) => e.trim()) && new Set(ejes.map((e) => e.trim().toLowerCase())).size === ejes.length;
  const completo = ejesValidos && !!nombre.trim() && fichas.every((f) => ejes.every((e) => (valores[f.sku]?.[e] ?? "").trim()));
  // Dos variantes con la misma combinación de valores no se distinguirían: se avisa antes de anotar.
  const combinaciones = fichas.map((f) => ejes.map((e) => (valores[f.sku]?.[e] ?? "").trim().toLowerCase()).join("|"));
  const repetida = completo && new Set(combinaciones).size !== combinaciones.length;

  const agrupar = () => {
    if (!familia || !completo || repetida) return;
    onGuardar({
      parentSku: familia.parentSku,
      name: nombre.trim(),
      axes: ejes.map((e) => e.trim()),
      variants: fichas.map((f) => ({ sellerSku: f.sku, values: Object.fromEntries(ejes.map((e) => [e.trim(), (valores[f.sku]?.[e] ?? "").trim()])) })),
    });
    onClose();
  };

  const cambiarEje = (i: number, nuevo: string) => {
    const anterior = ejes[i];
    setEjes((prev) => prev.map((e, j) => (j === i ? nuevo : e)));
    // El valor ya escrito sigue a su eje aunque se cambie el nombre del eje.
    setValores((prev) => Object.fromEntries(Object.entries(prev).map(([sku, v]) => [sku, Object.fromEntries(Object.entries(v).map(([k, x]) => [k === anterior ? nuevo : k, x]))])));
  };

  return (
    <Dialog open={!!familia} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="sm:max-w-[760px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estructurar variantes</DialogTitle>
          <DialogDescription>
            Familia {familia?.parentSku}: {fichas.length} productos. Define en qué se diferencian y el valor de cada uno. Las fotos, el precio y el stock de cada variante no cambian. Se agruparán al importar: no hace falta importar primero.
          </DialogDescription>
        </DialogHeader>

        {familia?.sugerencia && (
          <p className="text-xs text-yellow-400">
            La IA propuso estos valores ({familia.sugerencia.motivo}) y no se pudieron comprobar en los datos del canal. Mira cada foto y corrige lo que haga falta antes de agrupar.
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
          {repetida && <p className="text-xs text-red-400 mr-auto self-center">Dos variantes tienen la misma combinación: cada una debe ser distinta.</p>}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={agrupar} disabled={!completo || repetida}>Agrupar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
