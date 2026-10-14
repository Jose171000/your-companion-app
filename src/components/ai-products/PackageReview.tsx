import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ruler, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { syncApi } from "@/lib/sync-api";
import { Product } from "@/lib/products-api";

interface Props {
  product: Product;
  /** Se llama al guardar, con las medidas ya revisadas. */
  onReviewed: (medidas: { packageWidth: number; packageLength: number; packageHeight: number; packageWeight: number }) => void;
}

/**
 * Falabella calcula el envío que paga el comprador con las medidas del paquete.
 * Si el cliente no las dio, la IA las estima y aquí quedan a la vista para revisarlas
 * antes de publicar. Al guardarlas dejan de estar marcadas como estimadas.
 */
export function PackageReview({ product, onReviewed }: Props) {
  const estimadas = !!(product.aiAttributes as any)?.estimated?.measures;
  const categoryId = (product.marketplaceIds as any)?.falabella_category_id as string | undefined;

  const [ancho, setAncho] = useState("");
  const [largo, setLargo] = useState("");
  const [alto, setAlto] = useState("");
  const [peso, setPeso] = useState("");

  useEffect(() => {
    setAncho(product.packageWidth != null ? String(product.packageWidth) : "");
    setLargo(product.packageLength != null ? String(product.packageLength) : "");
    setAlto(product.packageHeight != null ? String(product.packageHeight) : "");
    setPeso(product.packageWeight != null ? String(product.packageWeight) : "");
  }, [product.id, product.packageWidth, product.packageLength, product.packageHeight, product.packageWeight]);

  const numeros = { w: Number(ancho), l: Number(largo), h: Number(alto), p: Number(peso) };
  const validas = Object.values(numeros).every((n) => Number.isFinite(n) && n > 0);

  const guardar = useMutation({
    mutationFn: () =>
      syncApi.prepareFalabella(product.id, {
        categoryId: categoryId!,
        packageWidth: Math.round(numeros.w),
        packageLength: Math.round(numeros.l),
        packageHeight: Math.round(numeros.h),
        packageWeight: numeros.p,
      }),
    onSuccess: (res) => {
      if (res.error) return toast.error(res.error);
      toast.success(res.data?.message ?? "Medidas guardadas");
      onReviewed({ packageWidth: Math.round(numeros.w), packageLength: Math.round(numeros.l), packageHeight: Math.round(numeros.h), packageWeight: numeros.p });
    },
    onError: () => toast.error("No se pudieron guardar las medidas"),
  });

  return (
    <Card className={`p-3 md:p-4 ${estimadas ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
      <div className="flex items-start gap-3">
        <Ruler className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Medidas del paquete para Falabella</p>
            {estimadas ? (
              <Badge className="bg-amber-500/15 text-amber-500 gap-1 text-[10px]">
                <AlertCircle className="w-3 h-3" /> Estimadas por la IA: revísalas
              </Badge>
            ) : (
              <Badge className="bg-green-500/10 text-green-500 gap-1 text-[10px]">
                <CheckCircle2 className="w-3 h-3" /> Revisadas
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Falabella usa estas medidas para calcular el envío que paga quien compra. Corrígelas si no coinciden con tu paquete real.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: "pk-ancho", label: "Ancho (cm)", value: ancho, set: setAncho },
              { id: "pk-largo", label: "Largo (cm)", value: largo, set: setLargo },
              { id: "pk-alto", label: "Alto (cm)", value: alto, set: setAlto },
              { id: "pk-peso", label: "Peso (kg)", value: peso, set: setPeso },
            ].map((c) => (
              <div key={c.id} className="space-y-1">
                <Label htmlFor={c.id} className="text-xs">{c.label}</Label>
                <Input id={c.id} type="number" min="0" step="0.1" value={c.value} onChange={(e) => c.set(e.target.value)} />
              </div>
            ))}
          </div>

          {categoryId ? (
            <Button size="sm" onClick={() => guardar.mutate()} disabled={!validas || guardar.isPending}>
              {guardar.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {estimadas ? "Confirmar medidas" : "Guardar cambios"}
            </Button>
          ) : (
            <p className="text-xs text-destructive">No se pudo asignar una categoría de Falabella a este producto; asígnala desde Productos.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
