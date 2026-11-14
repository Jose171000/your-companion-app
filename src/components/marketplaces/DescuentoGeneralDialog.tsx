import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Percent, Tag } from "lucide-react";
import { ResultadoDescuentoMasivo, syncApi } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Productos (variantes) a los que se aplica el mismo descuento */
  productIds: string[];
  /** «12 productos (47 variantes)», «Juego de sábanas · 32 variantes»… */
  resumen: string;
  /** Un precio regular de ejemplo para mostrar cuánto queda con el descuento */
  precioEjemplo?: number | null;
}

const aISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const enDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return aISO(d); };

/**
 * Un solo descuento para todos los canales (Falabella, Mercado Libre, WooCommerce y Ripley): en soles o en porcentaje,
 * siempre con fecha de fin. Mercado Libre limita cada promoción a 14 días: Synkro las encadena solo hasta la fecha de fin.
 */
export function DescuentoGeneralDialog({ open, onOpenChange, productIds, resumen, precioEjemplo }: Props) {
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<"precio" | "porcentaje">("porcentaje");
  const [valor, setValor] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [resultado, setResultado] = useState<{ tipo: "aplicar" | "quitar"; data: ResultadoDescuentoMasivo } | null>(null);

  useEffect(() => {
    if (open) { setModo("porcentaje"); setValor(""); setDesde(""); setHasta(""); setResultado(null); }
  }, [open]);

  const valorNum = Number(valor);
  const hoy = aISO(new Date());
  const errorDeValor =
    valor === "" ? null
      : Number.isNaN(valorNum) || valorNum <= 0 ? "Pon un número mayor que 0."
      : modo === "porcentaje" && valorNum >= 100 ? "El porcentaje debe ser menor que 100."
      : modo === "precio" && precioEjemplo != null && valorNum >= precioEjemplo ? `El precio con descuento debe ser menor que el precio regular (S/ ${precioEjemplo.toFixed(2)}).`
      : null;
  const errorDeFechas =
    hasta === "" ? null
      : hasta < hoy ? "La fecha de fin ya pasó."
      : desde !== "" && hasta < desde ? "La fecha de fin no puede ser anterior a la de inicio."
      : null;
  const listo = valor !== "" && !errorDeValor && hasta !== "" && !errorDeFechas && productIds.length > 0;

  const vista = useMemo(() => {
    if (precioEjemplo == null || valor === "" || errorDeValor) return null;
    const final = modo === "porcentaje" ? Math.round(precioEjemplo * (1 - valorNum / 100) * 100) / 100 : valorNum;
    const pct = Math.round((1 - final / precioEjemplo) * 1000) / 10;
    return final > 0 && final < precioEjemplo ? { final, pct } : null;
  }, [modo, valor, valorNum, precioEjemplo, errorDeValor]);

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["product-sheet"] });
  };

  const aplicar = useMutation({
    mutationFn: () => syncApi.applyDiscount({ productIds, modo, valor: valorNum, ...(desde ? { desde } : {}), hasta }),
    onSuccess: (res) => {
      if (res.error || !res.data) { toast.error(res.error ?? "No se pudo aplicar el descuento"); return; }
      setResultado({ tipo: "aplicar", data: res.data });
      refrescar();
      if (res.data.fallidos === 0) toast.success(`Descuento aplicado a ${res.data.aplicados} producto(s)`);
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const quitar = useMutation({
    mutationFn: () => syncApi.removeDiscount(productIds),
    onSuccess: (res) => {
      if (res.error || !res.data) { toast.error(res.error ?? "No se pudo quitar el descuento"); return; }
      setResultado({ tipo: "quitar", data: res.data });
      refrescar();
      if (res.data.fallidos === 0) toast.success(`Descuento quitado de ${res.data.quitados} producto(s)`);
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const ocupado = aplicar.isPending || quitar.isPending;
  const fallidos = resultado?.data.resultados.filter((r) => !r.ok) ?? [];
  // Los avisos de un canal que no recibió el descuento (por ejemplo Ripley) vienen dentro del mensaje de cada producto.
  const avisos = [...new Set((resultado?.data.resultados ?? []).filter((r) => r.ok).flatMap((r) => r.message.split(/(?<=\.)\s+/).filter((f) => /no recibió|no se pudo|no aplicó/i.test(f))))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tag className="w-4 h-4" /> Descuento para todos los canales</DialogTitle>
          <DialogDescription className="break-words">
            {resumen}. Se envía a Falabella, Mercado Libre, WooCommerce y Ripley donde estén publicados. Si quieres otro descuento en un canal, edítalo después en la ficha del producto.
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
              {fallidos.length === 0 ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />}
              <div>
                {resultado.tipo === "aplicar"
                  ? `Descuento aplicado a ${resultado.data.aplicados} de ${resultado.data.total} producto(s).`
                  : `Descuento quitado de ${resultado.data.quitados} de ${resultado.data.total} producto(s).`}
                <p className="text-xs text-muted-foreground mt-1">Los canales pueden tardar unos minutos en mostrarlo.</p>
              </div>
            </div>
            {avisos.length > 0 && (
              <ul className="text-xs text-amber-500 space-y-1 list-disc pl-5">{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
            )}
            {fallidos.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-semibold">No se pudo en {fallidos.length}:</p>
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  {fallidos.map((f) => (
                    <li key={f.productId} className="text-red-400 break-words">{f.sku ?? f.productId}: {f.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter><Button onClick={() => onOpenChange(false)}>Listo</Button></DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Cómo lo quieres poner</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={modo === "porcentaje" ? "default" : "outline"} onClick={() => setModo("porcentaje")}><Percent className="w-3.5 h-3.5 mr-1.5" /> En porcentaje</Button>
                <Button type="button" variant={modo === "precio" ? "default" : "outline"} onClick={() => setModo("precio")}>En soles (precio final)</Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="desc-valor">{modo === "porcentaje" ? "Porcentaje de descuento" : "Precio con descuento (S/)"}</Label>
              <Input id="desc-valor" type="number" min={0} step={modo === "porcentaje" ? "0.5" : "0.01"} value={valor} onChange={(e) => setValor(e.target.value)} placeholder={modo === "porcentaje" ? "Ej.: 15" : "Ej.: 199.90"} autoFocus />
              {errorDeValor ? <p className="text-[11px] text-red-400">{errorDeValor}</p>
                : vista ? <p className="text-[11px] text-muted-foreground">Ejemplo: S/ {precioEjemplo!.toFixed(2)} pasa a <b>S/ {vista.final.toFixed(2)}</b> ({vista.pct}% menos).</p>
                : modo === "precio" && productIds.length > 1 ? <p className="text-[11px] text-muted-foreground">El mismo precio final para todos; debe ser menor que el precio regular de cada uno.</p> : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="desc-desde" className="text-xs">Desde (opcional, por defecto hoy)</Label>
                <Input id="desc-desde" type="date" min={hoy} value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="desc-hasta" className="text-xs">Hasta (obligatoria)</Label>
                <Input id="desc-hasta" type="date" min={hoy} value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 -mt-1">
              {[{ t: "+30 días", d: 30 }, { t: "+90 días", d: 90 }, { t: "+1 año", d: 365 }].map((a) => (
                <Button key={a.d} type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setHasta(enDias(a.d))}>{a.t}</Button>
              ))}
            </div>
            {errorDeFechas && <p className="text-[11px] text-red-400">{errorDeFechas}</p>}

            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
              <li><b>Mercado Libre</b> acepta descuentos de 5% a 80% y cada promoción dura máximo 14 días: Synkro las encadena solo hasta tu fecha de fin.</li>
              <li><b>Falabella</b> recibe el precio especial con sus fechas; para quitarlo después hay que hacerlo en el Seller Center.</li>
              <li><b>Ripley</b> solo recibe el descuento si su envío de precios está habilitado, y debe quedar bajo su precio de lista.</li>
            </ul>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="outline" disabled={ocupado || productIds.length === 0} onClick={() => { if (window.confirm(`¿Quitar el descuento de ${resumen}? Mercado Libre, WooCommerce y Ripley lo quitan solos; Falabella no.`)) quitar.mutate(); }}>
                {quitar.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Quitar descuento
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button className="gradient-primary" disabled={!listo || ocupado} onClick={() => aplicar.mutate()}>
                  {aplicar.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Aplicar a {productIds.length}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
