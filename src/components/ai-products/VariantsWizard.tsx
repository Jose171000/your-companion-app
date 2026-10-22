import { useMemo, useState } from "react";
import { Check, CheckSquare, Loader2, Sparkles, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DeteccionDeVariantes, EjeDeVariacion } from "@/lib/variants-api";
import {
  MAX_FOTOS_POR_VARIANTE,
  MAX_VARIANTES,
  SUGERIDOS,
  alternarFoto,
  asignacionInicial,
  claveDe,
  combinaciones,
  etiquetaDe,
  normalizar,
  precioDeVariante,
  skuSugerido,
  type Valores,
} from "@/lib/variants-logic";

export interface ResultadoDelRecorrido {
  axes: EjeDeVariacion[];
  variants: { values: Valores; sku: string; price: number | null; stock: number | null; photoIndexes: number[] }[];
}

interface Props {
  photos: { src: string }[];
  parentSku: string;
  onParentSkuChange: (s: string) => void;
  basePrice: string;
  baseStock: string;
  /** Lo que la IA detectó antes de entrar: ejes, valores y a qué valor corresponde cada foto. */
  deteccion: DeteccionDeVariantes | null;
  busy: boolean;
  onSubmit: (r: ResultadoDelRecorrido) => void;
}

const tarjeta = "rounded-xl border border-border bg-card/40 p-3 md:p-4 animate-in fade-in slide-in-from-top-1 duration-300";

function Opcion({ activa, onClick, children, casilla }: { activa: boolean; onClick: () => void; children: React.ReactNode; casilla?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs md:text-sm transition-colors mr-2 mb-2",
        activa ? "border-[#FCCB34] bg-[#FCCB34]/15 text-foreground" : "border-border hover:border-[#FCCB34]/50 text-muted-foreground hover:text-foreground",
      )}
    >
      {casilla && (activa ? <CheckSquare className="w-4 h-4 text-[#FCCB34]" /> : <Square className="w-4 h-4" />)}
      {children}
    </button>
  );
}

function Etiqueta({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs mr-1.5 mb-1.5 transition-colors",
        activa ? "border-[#FCCB34] bg-[#FCCB34]/20 text-foreground" : "border-border text-muted-foreground hover:border-[#FCCB34]/50",
      )}
    >
      {children}
    </button>
  );
}

/** Campo con un check que se activa cuando hay texto: agrega lo escrito (Enter también sirve). */
function CampoConCheck({ placeholder, onAdd, ancho = "w-44" }: { placeholder: string; onAdd: (texto: string) => void; ancho?: string }) {
  const [texto, setTexto] = useState("");
  const listo = texto.trim().length > 0;
  const agregar = () => {
    if (!listo) return;
    onAdd(texto.trim());
    setTexto("");
  };
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <Input
        value={texto}
        placeholder={placeholder}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
        className={cn("h-8 text-xs", ancho)}
      />
      <button
        type="button"
        aria-label="Agregar"
        disabled={!listo}
        onClick={agregar}
        className={cn(
          "h-8 w-8 rounded-full border flex items-center justify-center transition-colors",
          listo ? "border-green-500 bg-green-500/15 text-green-500 hover:bg-green-500/25" : "border-border text-muted-foreground/50 cursor-not-allowed",
        )}
      >
        <Check className="w-4 h-4" />
      </button>
    </span>
  );
}

export function VariantsWizard({ photos, parentSku, onParentSkuChange, basePrice, baseStock, deteccion, busy, onSubmit }: Props) {
  const [axes, setAxes] = useState<string[]>(() => deteccion?.ejes.map((e) => e.name) ?? []);
  const [vals, setVals] = useState<Record<string, string[]>>(() => Object.fromEntries((deteccion?.ejes ?? []).map((e) => [e.name, e.values])));
  const [fotosModo, setFotosModo] = useState<"mismas" | "cambian" | null>(null);
  const [asign, setAsign] = useState<Record<string, number[]>>({});
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [precioEjes, setPrecioEjes] = useState<string[] | null>(null);
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [stockModo, setStockModo] = useState<"igual" | "variante" | null>(null);
  const [stockIgual, setStockIgual] = useState(baseStock);
  const [stocks, setStocks] = useState<Record<string, string>>({});
  const [skus, setSkus] = useState<Record<string, string>>({});
  const [excluidas, setExcluidas] = useState<string[]>([]);

  const ejes: EjeDeVariacion[] = useMemo(() => axes.map((name) => ({ name, values: vals[name] ?? [] })), [axes, vals]);
  const todas = useMemo(() => combinaciones(ejes), [ejes]);
  const variantes = useMemo(() => todas.filter((v) => !excluidas.includes(claveDe(v, ejes))), [todas, ejes, excluidas]);
  const claves = variantes.map((v) => claveDe(v, ejes));
  const hayCombos = todas.length > 0;
  const pocasFotos = photos.length <= 1;
  const modoFotos = pocasFotos ? "mismas" : fotosModo;

  const reiniciarDesdeFotos = () => {
    setFotosModo(null); setAsign({}); setMarcadas([]); setPrecioEjes(null); setPrecios({});
    setStockModo(null); setStocks({}); setSkus({}); setExcluidas([]);
  };

  const alternarEje = (name: string) => {
    setAxes((a) => (a.includes(name) ? a.filter((x) => x !== name) : [...a, name].slice(0, 3)));
    setVals((v) => ({ ...v, [name]: v[name] ?? [] }));
    reiniciarDesdeFotos();
  };
  const agregarEje = (name: string) => {
    if (axes.some((a) => normalizar(a) === normalizar(name)) || axes.length >= 3) return;
    setAxes((a) => [...a, name]);
    setVals((v) => ({ ...v, [name]: [] }));
    reiniciarDesdeFotos();
  };
  const alternarValor = (eje: string, valor: string) => {
    setVals((v) => {
      const lista = v[eje] ?? [];
      const existe = lista.some((x) => normalizar(x) === normalizar(valor));
      return { ...v, [eje]: existe ? lista.filter((x) => normalizar(x) !== normalizar(valor)) : [...lista, valor] };
    });
    reiniciarDesdeFotos();
  };

  // ── Fotos ──
  const elegirFotos = (modo: "mismas" | "cambian") => {
    setFotosModo(modo);
    setPrecioEjes(null); setPrecios({}); setStockModo(null); setStocks({});
    if (modo === "cambian" && !Object.values(asign).some((l) => l.length)) setAsign(asignacionInicial(variantes, ejes, photos.length, null));
  };
  const proponerConIa = () => {
    setAsign(asignacionInicial(variantes, ejes, photos.length, deteccion));
    setMarcadas([]);
  };
  const alternarMarcada = (k: string) => setMarcadas((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k]));
  const atajo = (filtro: (v: Valores) => boolean) => setMarcadas(variantes.filter(filtro).map((v) => claveDe(v, ejes)));
  const tocarFoto = (i: number) => setAsign((a) => alternarFoto(a, marcadas, i));
  const fotosDe = (k: string): number[] => (modoFotos === "mismas" ? photos.slice(0, MAX_FOTOS_POR_VARIANTE).map((_, i) => i) : asign[k] ?? []);

  // ── Precio y stock ──
  const alternarPrecioEje = (name: string) => {
    setPrecioEjes((p) => {
      const lista = p ?? [];
      return lista.includes(name) ? lista.filter((x) => x !== name) : [...lista, name];
    });
    setPrecios({}); setStockModo(null);
  };
  const precioTexto = (v: Valores) => precioDeVariante(v, precioEjes ?? [], precios, basePrice);
  const stockTexto = (k: string) => (stockModo === "igual" ? stockIgual : stocks[k] ?? stockIgual);
  const skuDe = (v: Valores) => skus[claveDe(v, ejes)] ?? (parentSku.trim() ? skuSugerido(parentSku, v, ejes) : "");

  const sinFotos = modoFotos === "cambian" ? variantes.filter((v) => !fotosDe(claveDe(v, ejes)).length) : [];
  const listoParaCrear = !!parentSku.trim() && variantes.length > 0 && variantes.length <= MAX_VARIANTES && sinFotos.length === 0 && !busy;

  const crear = () => {
    onSubmit({
      axes: ejes,
      variants: variantes.map((v) => {
        const k = claveDe(v, ejes);
        const precio = parseFloat(precioTexto(v));
        const stock = parseInt(stockTexto(k), 10);
        return {
          values: v,
          sku: skuDe(v),
          price: Number.isFinite(precio) ? precio : null,
          stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
          photoIndexes: fotosDe(k),
        };
      }),
    });
  };

  const pasoFotosListo = modoFotos !== null;
  const pasoPrecioListo = precioEjes !== null;
  const pasoStockListo = stockModo !== null;
  const objetivoUnico = marcadas.length === 1 ? marcadas[0] : null;

  return (
    <div className="space-y-3">
      {deteccion?.recomendar && (
        <p className="text-xs text-muted-foreground">
          Rellené lo que detecté en tus fotos y texto. Revísalo y corrige lo que haga falta.
        </p>
      )}

      {/* ¿En qué se diferencian? */}
      <div className={tarjeta}>
        <p className="text-sm font-medium mb-2">¿En qué se diferencian?</p>
        <div>
          {[...Object.keys(SUGERIDOS), ...axes.filter((a) => !(a in SUGERIDOS))].map((a) => (
            <Etiqueta key={a} activa={axes.includes(a)} onClick={() => alternarEje(a)}>{a}</Etiqueta>
          ))}
        </div>
        <CampoConCheck placeholder="Otro (ej. Diseño)" onAdd={agregarEje} />
        {axes.length >= 3 && <p className="text-[11px] text-muted-foreground mt-1">Hasta 3 ejes por producto.</p>}

        {axes.map((eje) => {
          const sugeridos = SUGERIDOS[eje] ?? [];
          const propios = (vals[eje] ?? []).filter((v) => !sugeridos.some((s) => normalizar(s) === normalizar(v)));
          return (
            <div key={eje} className="grid grid-cols-[84px_1fr] gap-2 items-start border-t border-border mt-3 pt-3 animate-in fade-in duration-300">
              <span className="text-sm font-medium pt-1">{eje}</span>
              <div>
                {[...sugeridos, ...propios].map((v) => (
                  <Etiqueta key={v} activa={(vals[eje] ?? []).some((x) => normalizar(x) === normalizar(v))} onClick={() => alternarValor(eje, v)}>{v}</Etiqueta>
                ))}
                <CampoConCheck placeholder="+ otro valor" ancho="w-32" onAdd={(v) => {
                  if (!(vals[eje] ?? []).some((x) => normalizar(x) === normalizar(v))) alternarValor(eje, v);
                }} />
              </div>
            </div>
          );
        })}
        {hayCombos && (
          <p className="text-[11px] text-muted-foreground mt-2">
            {todas.length} {todas.length === 1 ? "variante" : "variantes"}
            {todas.length > MAX_VARIANTES && <span className="text-red-400"> — el máximo es {MAX_VARIANTES}: quita valores.</span>}
          </p>
        )}
      </div>

      {/* Fotos */}
      {hayCombos && todas.length <= MAX_VARIANTES && (
        <div className={tarjeta}>
          {pocasFotos ? (
            <p className="text-sm">
              Solo subiste {photos.length === 1 ? "1 foto: se usará en todas las variantes" : "fotos de una sola versión"}.
              <span className="block text-xs text-muted-foreground mt-1">Para mejores resultados en los canales, sube una foto de cada versión.</span>
            </p>
          ) : (
            <>
              <p className="text-sm font-medium mb-2">¿Las fotos cambian entre variantes?</p>
              <Opcion activa={fotosModo === "mismas"} onClick={() => elegirFotos("mismas")}>No, son las mismas</Opcion>
              <Opcion activa={fotosModo === "cambian"} onClick={() => elegirFotos("cambian")}>Sí, cambian según la variante</Opcion>
            </>
          )}

          {modoFotos === "cambian" && (
            <div className="mt-2 space-y-3 animate-in fade-in duration-300">
              <div>
                <p className="text-xs font-medium mb-1.5">1. ¿A qué variantes les asignas fotos?</p>
                <div className="flex flex-wrap gap-1.5">
                  {variantes.map((v) => {
                    const k = claveDe(v, ejes);
                    const on = marcadas.includes(k);
                    const n = (asign[k] ?? []).length;
                    return (
                      <button key={k} type="button" onClick={() => alternarMarcada(k)} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs", on ? "border-[#FCCB34] bg-[#FCCB34]/15" : "border-border text-muted-foreground")}>
                        {on ? <CheckSquare className="w-3.5 h-3.5 text-[#FCCB34]" /> : <Square className="w-3.5 h-3.5" />}
                        {etiquetaDe(v, ejes)}
                        <span className={cn("rounded-full px-1.5 text-[10px]", n === 0 ? "bg-red-500/20 text-red-400" : "bg-secondary")}>{n}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-muted-foreground">Atajos:</span>
                  <button type="button" className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-[#FCCB34]/60" onClick={() => atajo(() => true)}>Todas</button>
                  {ejes.flatMap((e) => e.values.map((val) => (
                    <button key={`${e.name}:${val}`} type="button" className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-[#FCCB34]/60" onClick={() => atajo((v) => v[e.name] === val)}>
                      {e.name}: {val}
                    </button>
                  )))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium mb-1">2. Toca las fotos en el orden en que quieres mostrarlas</p>
                <p className="text-[11px] text-muted-foreground mb-2">
                  {marcadas.length === 0 ? "Marca primero una o más variantes." : marcadas.length === 1 ? "El número indica el orden; la primera es la principal." : `Se aplica a las ${marcadas.length} marcadas. «~» indica que solo algunas la tienen.`}
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                  {photos.map((p, i) => {
                    const enMarcadas = marcadas.filter((k) => (asign[k] ?? []).includes(i)).length;
                    const usada = claves.filter((k) => (asign[k] ?? []).includes(i)).length;
                    const todasLasMarcadas = marcadas.length > 0 && enMarcadas === marcadas.length;
                    const posicion = todasLasMarcadas ? (asign[marcadas[0]] ?? []).indexOf(i) + 1 : 0;
                    return (
                      <button key={i} type="button" onClick={() => tocarFoto(i)} className={cn("relative aspect-square rounded-lg overflow-hidden border-2", todasLasMarcadas ? "border-[#FCCB34]" : enMarcadas > 0 ? "border-border" : "border-dashed border-border")}>
                        <img src={p.src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                        {marcadas.length > 0 && enMarcadas > 0 && (
                          <span className={cn("absolute top-1 left-1 min-w-5 h-5 rounded-full text-[11px] font-medium flex items-center justify-center px-1", todasLasMarcadas ? "bg-[#FCCB34] text-[#111111]" : "bg-white/85 text-[#222222]")}>
                            {todasLasMarcadas ? posicion : "~"}
                          </span>
                        )}
                        {todasLasMarcadas && posicion === 1 && <span className="absolute bottom-1 left-1 rounded-full bg-black/60 text-white text-[10px] px-1.5">Principal</span>}
                        {usada > 0 && <span className="absolute bottom-1 right-1 rounded-full bg-white/85 text-[#222222] text-[10px] px-1.5">{usada}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {deteccion?.fotos?.some((f) => f.valores) && (
                    <Button type="button" variant="outline" size="sm" onClick={proponerConIa}><Sparkles className="w-3.5 h-3.5 mr-1.5" />Asignar con IA</Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" disabled={!marcadas.length} onClick={() => setAsign((a) => { const s = { ...a }; marcadas.forEach((k) => { s[k] = []; }); return s; })}>Quitar las fotos de las marcadas</Button>
                  {objetivoUnico && <span className="text-[11px] text-muted-foreground">Máximo {MAX_FOTOS_POR_VARIANTE} fotos por variante.</span>}
                </div>
                {sinFotos.length > 0 && <p className="text-[11px] text-red-400 mt-2">Sin fotos: {sinFotos.map((v) => etiquetaDe(v, ejes)).join(", ")}.</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Precio */}
      {hayCombos && pasoFotosListo && sinFotos.length === 0 && (
        <div className={tarjeta}>
          <p className="text-sm font-medium mb-2">¿El precio es el mismo en todas?</p>
          <Opcion activa={precioEjes !== null && precioEjes.length === 0} onClick={() => { setPrecioEjes([]); setPrecios({}); setStockModo(null); }}>
            Sí{basePrice ? `, S/ ${parseFloat(basePrice).toFixed(2)} en todas` : ""}
          </Opcion>
          {ejes.map((e) => (
            <Opcion key={e.name} casilla activa={!!precioEjes?.includes(e.name)} onClick={() => alternarPrecioEje(e.name)}>Varía según {e.name.toLowerCase()}</Opcion>
          ))}
          <p className="text-[11px] text-muted-foreground">Puedes marcar más de un eje, por ejemplo color y talla.</p>

          {precioEjes && precioEjes.length === 1 && (
            <div className="flex flex-wrap gap-3 mt-2">
              {(ejes.find((e) => e.name === precioEjes[0])?.values ?? []).map((v) => (
                <label key={v} className="text-[11px] text-muted-foreground space-y-1">
                  <span className="block">{v}</span>
                  <Input type="number" min="0" step="0.01" className="h-8 w-24 text-xs" value={precios[v] ?? basePrice} onChange={(e) => setPrecios((p) => ({ ...p, [v]: e.target.value }))} />
                </label>
              ))}
            </div>
          )}
          {precioEjes && precioEjes.length === 2 && (() => {
            const [a, b] = precioEjes.map((n) => ejes.find((e) => e.name === n)!);
            return (
              <div className="mt-2 overflow-x-auto">
                <p className="text-[11px] text-muted-foreground mb-1">Un precio por cada combinación de {a.name.toLowerCase()} y {b.name.toLowerCase()}:</p>
                <table className="text-xs">
                  <thead><tr><th />{b.values.map((c) => <th key={c} className="px-2 pb-1 font-normal text-muted-foreground">{c}</th>)}</tr></thead>
                  <tbody>
                    {a.values.map((f) => (
                      <tr key={f}>
                        <td className="pr-2 text-muted-foreground whitespace-nowrap">{f}</td>
                        {b.values.map((c) => {
                          const k = `${f}|${c}`;
                          return <td key={c} className="p-0.5"><Input type="number" min="0" step="0.01" className="h-8 w-24 text-xs" value={precios[k] ?? basePrice} onChange={(e) => setPrecios((p) => ({ ...p, [k]: e.target.value }))} /></td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
          {precioEjes && precioEjes.length > 2 && <p className="text-[11px] text-muted-foreground mt-2">Con tres ejes, el precio de cada variante se escribe en la tabla final.</p>}
        </div>
      )}

      {/* Stock */}
      {hayCombos && pasoFotosListo && pasoPrecioListo && sinFotos.length === 0 && (
        <div className={tarjeta}>
          <p className="text-sm font-medium mb-2">¿Y el stock?</p>
          <Opcion activa={stockModo === "igual"} onClick={() => setStockModo("igual")}>Es el mismo en todas</Opcion>
          <Opcion activa={stockModo === "variante"} onClick={() => setStockModo("variante")}>Lo indico por variante</Opcion>
          {stockModo === "igual" && (
            <label className="block text-[11px] text-muted-foreground mt-1">
              Unidades de cada una
              <Input type="number" min="0" step="1" className="h-8 w-28 text-xs mt-1" value={stockIgual} onChange={(e) => setStockIgual(e.target.value)} />
            </label>
          )}
        </div>
      )}

      {/* Revisión */}
      {hayCombos && pasoFotosListo && pasoPrecioListo && pasoStockListo && sinFotos.length === 0 && (
        <div className={tarjeta}>
          <p className="text-sm font-medium mb-2">Revisa tus {variantes.length} variantes</p>
          <label className="block text-[11px] text-muted-foreground mb-3">
            Código del grupo (SKU)
            <Input className="h-8 text-xs mt-1 max-w-xs" value={parentSku} onChange={(e) => onParentSkuChange(e.target.value)} placeholder="Ej: MK-1" />
          </label>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="font-normal pb-1 pr-2">Variante</th>
                  <th className="font-normal pb-1 pr-2">SKU</th>
                  {modoFotos === "cambian" && <th className="font-normal pb-1 pr-2">Fotos</th>}
                  {(precioEjes?.length ?? 0) > 0 && <th className="font-normal pb-1 pr-2">Precio</th>}
                  {stockModo === "variante" && <th className="font-normal pb-1 pr-2">Stock</th>}
                  <th />
                </tr>
              </thead>
              <tbody>
                {variantes.map((v) => {
                  const k = claveDe(v, ejes);
                  return (
                    <tr key={k} className="border-t border-border">
                      <td className="py-1.5 pr-2 whitespace-nowrap">{etiquetaDe(v, ejes)}</td>
                      <td className="py-1.5 pr-2"><Input className="h-7 text-xs min-w-36" value={skuDe(v)} onChange={(e) => setSkus((s) => ({ ...s, [k]: e.target.value }))} /></td>
                      {modoFotos === "cambian" && <td className="py-1.5 pr-2 text-muted-foreground whitespace-nowrap">{fotosDe(k).length} {fotosDe(k).length === 1 ? "foto" : "fotos"}</td>}
                      {(precioEjes?.length ?? 0) > 0 && (
                        <td className="py-1.5 pr-2">
                          {precioEjes!.length > 2
                            ? <Input type="number" min="0" step="0.01" className="h-7 w-24 text-xs" value={precios[k] ?? basePrice} onChange={(e) => setPrecios((p) => ({ ...p, [k]: e.target.value }))} />
                            : <span>S/ {parseFloat(precioTexto(v) || "0").toFixed(2)}</span>}
                        </td>
                      )}
                      {stockModo === "variante" && <td className="py-1.5 pr-2"><Input type="number" min="0" step="1" className="h-7 w-20 text-xs" value={stocks[k] ?? stockIgual} onChange={(e) => setStocks((s) => ({ ...s, [k]: e.target.value }))} /></td>}
                      <td className="py-1.5">
                        <button type="button" aria-label="Quitar variante" className="text-muted-foreground hover:text-red-400" onClick={() => setExcluidas((x) => [...x, k])}><X className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {excluidas.length > 0 && (
            <button type="button" className="text-[11px] text-muted-foreground underline mt-2" onClick={() => setExcluidas([])}>Volver a incluir las {excluidas.length} variantes quitadas</button>
          )}
          {!parentSku.trim() && <p className="text-[11px] text-red-400 mt-2">Escribe el código del grupo (SKU).</p>}
          <Button type="button" disabled={!listoParaCrear} onClick={crear} className="w-full h-11 mt-3 rounded-[12px] font-semibold bg-[#111111] dark:bg-[#FCCB34] text-white dark:text-[#111111] hover:bg-[#222222] dark:hover:bg-[#E6B620]">
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creando variantes…</> : <><Sparkles className="w-4 h-4 mr-2 text-[#FCCB34] dark:text-[#111111]" />Generar con IA</>}
          </Button>
        </div>
      )}
    </div>
  );
}
