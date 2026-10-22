import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { syncApi } from "@/lib/sync-api";
import { Product } from "@/lib/products-api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Loader2, Package, Search } from "lucide-react";
import { FalabellaBrandField } from "./FalabellaBrandField";

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

/** Espera a que el usuario deje de escribir antes de consultar. */
function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Falabella exige, para cada producto, datos que el resto de canales no pide:
 * una categoría de su propio árbol, las medidas del paquete y los atributos
 * particulares de esa categoría —que cambian de una a otra—.
 *
 * En vez de mostrar un formulario fijo con todo lo imaginable, se le pregunta
 * a Falabella qué exige la categoría elegida y se dibujan solo esos campos.
 */
export function PrepareFalabellaDialog({ product, open, onClose }: Props) {
  const queryClient = useQueryClient();

  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<{ id: string; path: string } | null>(null);
  const [medidas, setMedidas] = useState({ ancho: "", largo: "", alto: "", peso: "" });
  const [atributos, setAtributos] = useState<Record<string, string>>({});
  const [marca, setMarca] = useState("GENERICO");

  const busquedaDiferida = useDebounced(busqueda);

  // Al abrir, se parte de lo que el producto ya tenga guardado.
  useEffect(() => {
    if (!open || !product) return;
    const guardada = (product.marketplaceIds as any)?.falabella_category_id;
    setCategoria(guardada ? { id: String(guardada), path: `Categoría ${guardada}` } : null);
    setMedidas({
      ancho: product.packageWidth != null ? String(product.packageWidth) : "",
      largo: product.packageLength != null ? String(product.packageLength) : "",
      alto: product.packageHeight != null ? String(product.packageHeight) : "",
      peso: product.packageWeight != null ? String(product.packageWeight) : "",
    });
    // Lo que la IA ya completó se muestra, para revisarlo en vez de escribirlo de nuevo.
    const previos = (product.aiAttributes as any) || {};
    setAtributos(Object.fromEntries(Object.entries(previos).filter(([k, v]) => typeof v === "string" && k !== "descriptionHtml")) as Record<string, string>);
    setMarca(previos.brand || "GENERICO");
    setBusqueda("");
  }, [open, product]);

  const { data: categorias, isFetching: buscando } = useQuery({
    queryKey: ["falabella-categories", busquedaDiferida],
    queryFn: () => syncApi.searchFalabellaCategories(busquedaDiferida),
    enabled: open && busquedaDiferida.trim().length >= 3,
    staleTime: 10 * 60_000,
  });

  const { data: camposResult, isFetching: cargandoCampos } = useQuery({
    queryKey: ["falabella-fields", categoria?.id],
    queryFn: () => syncApi.getFalabellaCategoryFields(categoria!.id),
    enabled: open && !!categoria?.id,
    staleTime: 10 * 60_000,
  });

  const campos = camposResult?.data ?? [];

  // Al elegir (o cambiar) la categoría, la IA llena todos los atributos que se puedan sacar del producto.
  const sugerir = useMutation({
    mutationFn: (categoryId: string) => syncApi.suggestFalabellaAttributes(product!.id, categoryId),
    onSuccess: (res) => {
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudieron sugerir los datos de la categoría");
        return;
      }
      // Lo que la persona ya escribió tiene prioridad sobre lo que sugiere la IA.
      setAtributos((previos) => ({
        ...res.data!.values,
        ...Object.fromEntries(Object.entries(previos).filter(([, v]) => v?.trim())),
      }));
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });
  useEffect(() => {
    if (open && product && categoria?.id) sugerir.mutate(categoria.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id, categoria?.id]);

  const guardar = useMutation({
    mutationFn: () =>
      syncApi.prepareFalabella(product!.id, {
        categoryId: categoria!.id,
        packageWidth: Number(medidas.ancho),
        packageLength: Number(medidas.largo),
        packageHeight: Number(medidas.alto),
        packageWeight: Number(medidas.peso),
        attributes: atributos,
      }),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.data?.listo) toast.success(res.data.message);
      else toast.warning(res.data?.message ?? "Guardado");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
    onError: () => toast.error("Error al guardar los datos de Falabella"),
  });

  const obligatorios = campos.filter((c) => c.required !== false);
  const recomendados = campos.filter((c) => c.required === false);
  const faltanCampos = obligatorios.filter((c) => !atributos[c.name]?.trim());
  const medidasCompletas =
    Number(medidas.ancho) > 0 &&
    Number(medidas.largo) > 0 &&
    Number(medidas.alto) > 0 &&
    Number(medidas.peso) > 0;
  const listo = !!categoria && medidasCompletas && faltanCampos.length === 0;

  const resultados = useMemo(() => categorias?.data ?? [], [categorias]);

  // Las categorías más cercanas que dejó la IA cuando ninguna encajó del todo.
  const sugeridas: { id: string; path: string }[] = ((product?.aiAttributes as any)?._categoriaDudosa?.options ?? []).filter((c: any) => c?.id && c?.path);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Preparar para Falabella
          </DialogTitle>
          <DialogDescription>
            {product?.name}. Falabella pide una categoría de su catálogo, las medidas del
            paquete y los datos propios de esa categoría.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Categoría ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Categoría de Falabella</Label>

            {categoria ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{categoria.path}</p>
                  <p className="text-xs text-muted-foreground">ID {categoria.id}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCategoria(null)}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <>
                {sugeridas.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {(product?.aiAttributes as any)?._categoriaDudosa?.motivo
                        ? `La IA no encontró una que encaje del todo (${(product?.aiAttributes as any)._categoriaDudosa.motivo}). Estas son las más cercanas:`
                        : "Las más cercanas al producto:"}
                    </p>
                    <div className="rounded-lg border border-border divide-y divide-border/50">
                      {sugeridas.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setCategoria({ id: c.id, path: c.path })}
                          className="w-full text-left p-3 hover:bg-secondary/40 transition-colors"
                        >
                          <p className="text-sm font-medium">{c.path}</p>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Elige una o busca otra abajo. Al elegirla, la IA llena sus datos con lo que sabe del producto.</p>
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Escribe qué vendes: mascarilla, audífonos, guantes…"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>

                {busqueda.trim().length > 0 && busqueda.trim().length < 3 && (
                  <p className="text-xs text-muted-foreground">Escribe al menos 3 letras.</p>
                )}

                {buscando && <Skeleton className="h-16 w-full" />}

                {!buscando && busquedaDiferida.trim().length >= 3 && (
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border/50">
                    {resultados.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3">
                        Ninguna categoría coincide. Prueba con otra palabra.
                      </p>
                    ) : (
                      resultados.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setCategoria({ id: c.id, path: c.path })}
                          className="w-full text-left p-3 hover:bg-secondary/40 transition-colors"
                        >
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.path}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Marca ─────────────────────────────────────────────────── */}
          {product && (
            <FalabellaBrandField
              productId={product.id}
              value={marca}
              onSaved={(m) => setMarca(m)}
            />
          )}

          {/* ── Medidas ───────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Medidas del paquete</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Falabella calcula con ellas el envío que paga el comprador, así que deben ser
              las reales.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                ["ancho", "Ancho (cm)"],
                ["largo", "Largo (cm)"],
                ["alto", "Alto (cm)"],
                ["peso", "Peso (kg)"],
              ] as const).map(([clave, etiqueta]) => (
                <div key={clave} className="space-y-1">
                  <Label htmlFor={`fb-${clave}`} className="text-xs font-normal text-muted-foreground">
                    {etiqueta}
                  </Label>
                  <Input
                    id={`fb-${clave}`}
                    type="number"
                    min="0"
                    step={clave === "peso" ? "0.01" : "1"}
                    value={medidas[clave]}
                    onChange={(e) => setMedidas((m) => ({ ...m, [clave]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Campos propios de la categoría ────────────────────────── */}
          {categoria && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Datos que pide esta categoría</Label>
                {!cargandoCampos && (
                  <Badge variant="outline" className="text-[10px]">
                    {campos.length === 0 ? "ninguno" : `${obligatorios.length} obligatorios · ${recomendados.length} recomendados`}
                  </Badge>
                )}
              </div>

              {sugerir.isPending && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> La IA está completando los datos con lo que sabe del producto…
                </p>
              )}
              {sugerir.data?.data && !sugerir.isPending && (
                <p className="text-[11px] text-muted-foreground">
                  La IA completó {sugerir.data.data.filled} de {sugerir.data.data.total} datos. Revisa los que quedaron vacíos: son los que no se pueden deducir del producto (por ejemplo, garantías o certificaciones).
                </p>
              )}

              {cargandoCampos ? (
                <Skeleton className="h-10 w-full" />
              ) : campos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esta categoría no pide nada más. Con la categoría y las medidas basta.
                </p>
              ) : (
                <div className="space-y-3">
                  {[...obligatorios, ...recomendados].map((campo) => (
                    <div key={campo.name} className="space-y-1">
                      <Label htmlFor={`fb-attr-${campo.name}`} className="text-xs">
                        {campo.label}
                        {campo.required === false ? (
                          <span className="ml-1 text-[10px] text-muted-foreground font-normal">recomendado: sube la calidad</span>
                        ) : (
                          <span className="ml-1 text-[10px] text-destructive font-normal">obligatorio</span>
                        )}
                      </Label>
                      {campo.description && <p className="text-[11px] text-muted-foreground break-words">{campo.description}</p>}
                      {campo.options.length > 0 ? (
                        <Select
                          value={atributos[campo.name] ?? ""}
                          onValueChange={(v) => setAtributos((a) => ({ ...a, [campo.name]: v }))}
                        >
                          <SelectTrigger id={`fb-attr-${campo.name}`}>
                            <SelectValue placeholder="Elige una opción" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {campo.options.map((o) => (
                              <SelectItem key={o} value={o}>
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={`fb-attr-${campo.name}`}
                          value={atributos[campo.name] ?? ""}
                          onChange={(e) =>
                            setAtributos((a) => ({ ...a, [campo.name]: e.target.value }))
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={guardar.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => guardar.mutate()} disabled={!listo || guardar.isPending}>
            {guardar.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5 mr-2" />
            )}
            {guardar.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
