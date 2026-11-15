import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Loader2, Percent, Tag, Trash2 } from "lucide-react";
import { syncApi } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { channelName, money } from "./format";
import { cn } from "@/lib/utils";

/** Un canal (una cuenta) donde el producto está publicado y puede tener su propio precio con descuento. */
export interface CanalDeDescuento {
  listingId: string;
  marketplace: string;
  cuenta: string | null;
  /** Precio regular que ese canal usa hoy (el suyo propio o el del producto) */
  precioRegular: number | null;
  /** Lo que el canal muestra hoy con descuento */
  mostrado: number | null;
  /** Descuento fijado solo para esta cuenta (manda sobre el general) */
  propio: { price: number; start: string | null; end: string | null } | null;
}

interface Props {
  /** Productos (variantes) a los que se aplica el descuento general */
  productIds: string[];
  /** Precio regular del producto, para el ejemplo y las validaciones */
  precioBase: number | null;
  /** Descuento general que el producto tiene hoy */
  general?: { price: number | null; start: string | null; end: string | null } | null;
  /** Canales donde se puede poner un precio distinto; sin canales no se muestra el bloque desplegable */
  canales?: CanalDeDescuento[];
  /** Texto que dice a qué se aplica (p. ej. «las 32 variantes») */
  alcance?: string;
  onDone?: () => void;
}

const aISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const enDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return aISO(d); };
const fecha = (f: string | null | undefined) => (f ? String(f).slice(0, 10) : "");

/**
 * Descuento del producto, en dos pasos: primero lo simple (el precio con descuento en soles o el %, con su fecha de fin), que va a todos los
 * canales; y, si se quiere, se despliega un precio distinto para cada canal conectado (ese manda sobre el general).
 * Con el modo revisión, el servidor deja cada cuenta como una solicitud que se aprueba aparte.
 */
export function DescuentoDelProducto({ productIds, precioBase, general, canales = [], alcance, onDone }: Props) {
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<"porcentaje" | "precio">("porcentaje");
  const [valor, setValor] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [porCanal, setPorCanal] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);

  const clave = productIds.join(",");
  const claveCanales = canales.map((c) => `${c.listingId}:${c.propio?.price ?? ""}`).join(",");
  useEffect(() => {
    setValor("");
    setDesde("");
    setHasta(general?.end ? fecha(general.end) : "");
    setPorCanal(Object.fromEntries(canales.map((c) => [c.listingId, c.propio ? String(c.propio.price) : ""])));
    setAbierto(canales.some((c) => c.propio));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, claveCanales]);

  const hoy = aISO(new Date());
  const valorNum = Number(valor);
  const hayGeneral = valor !== "";
  const errorDeValor =
    !hayGeneral ? null
      : Number.isNaN(valorNum) || valorNum <= 0 ? "Pon un número mayor que 0."
      : modo === "porcentaje" && valorNum >= 100 ? "El porcentaje debe ser menor que 100."
      : modo === "precio" && precioBase != null && valorNum >= precioBase ? `El precio con descuento debe ser menor que el regular (${money(precioBase)}).`
      : null;

  // Solo los canales cuyo precio con descuento cambió.
  const cambiosDeCanal = canales
    .map((c) => ({ c, texto: (porCanal[c.listingId] ?? "").trim() }))
    .filter(({ c, texto }) => texto !== "" && Number(texto) !== (c.propio?.price ?? null));
  const errorDeCanal = cambiosDeCanal
    .map(({ c, texto }) => {
      const n = Number(texto);
      const base = c.precioRegular ?? precioBase;
      if (Number.isNaN(n) || n <= 0) return `${channelName(c.marketplace)}: pon un número mayor que 0.`;
      if (base != null && n >= base) return `${channelName(c.marketplace)}: debe ser menor que ${money(base)}.`;
      return null;
    })
    .find(Boolean) ?? null;

  const errorDeFechas =
    hasta === "" ? null
      : hasta < hoy ? "La fecha de fin ya pasó."
      : desde !== "" && hasta < desde ? "La fecha de fin no puede ser anterior a la de inicio."
      : null;
  const hayAlgo = hayGeneral || cambiosDeCanal.length > 0;
  const listo = hayAlgo && hasta !== "" && !errorDeValor && !errorDeCanal && !errorDeFechas && productIds.length > 0;

  const vista = useMemo(() => {
    if (precioBase == null || !hayGeneral || errorDeValor) return null;
    const final = modo === "porcentaje" ? Math.round(precioBase * (1 - valorNum / 100) * 100) / 100 : valorNum;
    const pct = Math.round((1 - final / precioBase) * 1000) / 10;
    return final > 0 && final < precioBase ? { final, pct } : null;
  }, [modo, valorNum, precioBase, hayGeneral, errorDeValor]);

  const refrescar = () => {
    for (const k of ["sync-listings", "products", "product-sheet", "sync-change-requests", "group-prices"]) queryClient.invalidateQueries({ queryKey: [k] });
    onDone?.();
  };

  const aplicar = async () => {
    setOcupado(true);
    const mensajes: string[] = [];
    const fallos: string[] = [];
    try {
      if (hayGeneral) {
        const res = await syncApi.applyDiscount({ productIds, modo, valor: valorNum, ...(desde ? { desde } : {}), hasta });
        if (res.error || !res.data) fallos.push(res.error ?? "No se pudo aplicar el descuento general.");
        else {
          if (res.data.fallidos) fallos.push(...res.data.resultados.filter((r) => !r.ok).map((r) => `${r.sku ?? "producto"}: ${r.message}`));
          if (res.data.aplicados) mensajes.push(`Descuento general en ${res.data.aplicados} producto(s).`);
        }
      }
      // El de una cuenta va después: si hay una solicitud pendiente del general para esa cuenta, esta la reemplaza.
      for (const { c, texto } of cambiosDeCanal) {
        const res = await syncApi.setListingPromo(c.listingId, { salePrice: Number(texto), saleStart: desde || null, saleEnd: hasta });
        if (res.error) fallos.push(`${channelName(c.marketplace)}${c.cuenta ? ` · ${c.cuenta}` : ""}: ${res.error}`);
        else mensajes.push(res.data?.message ?? `Descuento en ${channelName(c.marketplace)}.`);
      }
    } finally {
      setOcupado(false);
    }
    if (mensajes.length) toast.success(mensajes[mensajes.length - 1], { description: mensajes.length > 1 ? mensajes.slice(0, -1).join(" ") : undefined });
    for (const f of fallos.slice(0, 3)) toast.error(f);
    if (mensajes.length) {
      setValor("");
      refrescar();
    }
  };

  const quitar = async () => {
    const conPropio = canales.filter((c) => c.propio);
    if (!window.confirm(`¿Quitar el descuento${alcance ? ` de ${alcance}` : ""}? En Mercado Libre, WooCommerce y Ripley se retira solo; en Falabella hay que quitarlo en el Seller Center. Con el modo revisión, cada cuenta pedirá su aprobación.`)) return;
    setOcupado(true);
    const fallos: string[] = [];
    try {
      const res = await syncApi.removeDiscount(productIds);
      if (res.error || !res.data) fallos.push(res.error ?? "No se pudo quitar el descuento general.");
      else if (res.data.fallidos) fallos.push(...res.data.resultados.filter((r) => !r.ok).map((r) => r.message));
      for (const c of conPropio) {
        const r = await syncApi.setListingPromo(c.listingId, { salePrice: null });
        if (r.error) fallos.push(`${channelName(c.marketplace)}: ${r.error}`);
      }
    } finally {
      setOcupado(false);
    }
    if (fallos.length) fallos.slice(0, 3).forEach((f) => toast.error(f));
    else toast.success("Descuento quitado. Con el modo revisión, aprueba cada cuenta en el Tablero (o en Revisión).");
    refrescar();
  };

  const tieneDescuento = general?.price != null || canales.some((c) => c.propio || c.mostrado != null);

  return (
    <div className="space-y-3 rounded-lg border border-border p-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Descuento</p>
          <p className="text-[11px] text-muted-foreground break-words">
            {general?.price != null
              ? <>Hoy: <b className="text-foreground">{money(general.price)}</b>{general.end ? ` hasta el ${fecha(general.end)}` : ""} en todos los canales{alcance ? ` (${alcance})` : ""}.</>
              : <>Sin descuento general{alcance ? ` en ${alcance}` : ""}.</>}
          </p>
        </div>
        {tieneDescuento && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-red-400 shrink-0" disabled={ocupado} onClick={quitar}>
            <Trash2 className="w-3.5 h-3.5" /> Quitar
          </Button>
        )}
      </div>

      {/* 1. Lo simple: un descuento para todos los canales */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" size="sm" variant={modo === "porcentaje" ? "default" : "outline"} onClick={() => setModo("porcentaje")}><Percent className="w-3.5 h-3.5 mr-1.5" /> En %</Button>
          <Button type="button" size="sm" variant={modo === "precio" ? "default" : "outline"} onClick={() => setModo("precio")}>En soles (precio final)</Button>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{modo === "porcentaje" ? "Porcentaje de descuento" : "Precio con descuento (S/)"}</Label>
          <Input type="number" min={0} step={modo === "porcentaje" ? "0.5" : "0.01"} value={valor} placeholder={modo === "porcentaje" ? "Ej.: 15" : "Ej.: 199.90"} onChange={(e) => setValor(e.target.value)} />
          {errorDeValor
            ? <p className="text-[11px] text-red-400">{errorDeValor}</p>
            : vista
              ? <p className="text-[11px] text-muted-foreground">{money(precioBase)} pasa a <b>{money(vista.final)}</b> ({vista.pct}% menos) en todos los canales.</p>
              : <p className="text-[11px] text-muted-foreground">Va a todos los canales donde está publicado.</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Desde (opcional)</Label>
            <Input type="date" min={hoy} value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta (obligatoria)</Label>
            <Input type="date" min={hoy} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ t: "+30 días", d: 30 }, { t: "+90 días", d: 90 }, { t: "+1 año", d: 365 }].map((a) => (
            <Button key={a.d} type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setHasta(enDias(a.d))}>{a.t}</Button>
          ))}
        </div>
        {errorDeFechas && <p className="text-[11px] text-red-400">{errorDeFechas}</p>}
      </div>

      {/* 2. Opcional: un precio distinto en cada canal conectado */}
      {canales.length > 0 && (
        <div className="rounded-lg border border-border/60">
          <button type="button" className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-secondary/30" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
            {abierto ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
            Precio con descuento distinto en cada canal
            <span className="font-normal text-muted-foreground">({canales.length} canal{canales.length === 1 ? "" : "es"})</span>
          </button>
          {abierto && (
            <div className="px-3 pb-3 space-y-2">
              <p className="text-[11px] text-muted-foreground">Lo que pongas en un canal manda sobre el descuento general. Se usan las mismas fechas. Vacío usa el general.</p>
              {canales.map((c) => {
                const id = `dc-${c.listingId}`;
                const nombre = `${channelName(c.marketplace)}${c.cuenta ? ` · ${c.cuenta}` : ""}`;
                return (
                  <div key={c.listingId} className="grid grid-cols-1 min-[420px]:grid-cols-[1fr_9rem] gap-2 items-end">
                    <div className="min-w-0">
                      <Label htmlFor={id} className="text-xs font-medium break-words">{nombre}</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Regular {c.precioRegular != null ? money(c.precioRegular) : "—"}
                        {c.mostrado != null && <> · hoy <span className="text-green-500">desc. {money(c.mostrado)}</span></>}
                      </p>
                    </div>
                    <Input id={id} type="number" min={0} step="0.01" placeholder="Igual al general" value={porCanal[c.listingId] ?? ""} onChange={(e) => setPorCanal((p) => ({ ...p, [c.listingId]: e.target.value }))} className={cn(c.propio && "border-primary/50")} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {errorDeCanal && <p className="text-[11px] text-red-400">{errorDeCanal}</p>}
      {hayAlgo && hasta === "" && <p className="text-[11px] text-amber-500">Falta la fecha de fin: el descuento siempre lleva una.</p>}

      <div className="flex justify-end">
        <Button type="button" size="sm" className="gradient-primary gap-1.5" disabled={!listo || ocupado} onClick={aplicar}>
          {ocupado && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Aplicar descuento
        </Button>
      </div>
    </div>
  );
}
