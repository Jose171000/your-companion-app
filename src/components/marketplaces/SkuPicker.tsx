import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { ManualSaleProduct, syncApi } from "@/lib/sync-api";
import { Input } from "@/components/ui/input";
import { ProductThumb } from "./ProductThumb";

/**
 * Elige el producto de una venta: se escribe el SKU o parte del nombre y se muestran los productos del catálogo que
 * coinciden, para elegir uno aunque no se recuerde el SKU. Una vez elegido se ve su ficha y se puede cambiar.
 */
export function SkuPicker({ value, onPick, onClear }: {
  value: ManualSaleProduct | null;
  onPick: (p: ManualSaleProduct) => void;
  onClear: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ManualSaleProduct[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [sinResultados, setSinResultados] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  // Busca 300 ms después de dejar de escribir.
  useEffect(() => {
    const q = texto.trim();
    if (!q) { setResultados([]); setSinResultados(false); return; }
    let vigente = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      const res = await syncApi.searchManualSaleProducts(q);
      if (!vigente) return;
      setBuscando(false);
      const lista = res.data ?? [];
      setResultados(lista);
      setSinResultados(lista.length === 0);
      setAbierto(true);
    }, 300);
    return () => { vigente = false; clearTimeout(t); };
  }, [texto]);

  // Se cierra al hacer clic fuera.
  useEffect(() => {
    const fuera = (e: MouseEvent) => { if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-2">
        <ProductThumb src={value.imageUrl} alt={value.name} className="w-10 h-10" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{value.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            <code className="font-mono">{value.sku}</code>
            {value.variant ? ` · ${value.variant}` : ""} · Stock {value.stock}{value.price != null ? ` · S/ ${value.price.toFixed(2)}` : ""}
          </p>
        </div>
        <button type="button" onClick={() => { onClear(); setTexto(""); }} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Cambiar producto">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={contenedor} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        className="pl-9"
        placeholder="Buscar por SKU o nombre del producto"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={() => (resultados.length || sinResultados) && setAbierto(true)}
      />
      {buscando && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
      {abierto && (resultados.length > 0 || sinResultados) && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          {sinResultados ? (
            <p className="p-3 text-sm text-muted-foreground">Ningún producto coincide con «{texto.trim()}».</p>
          ) : (
            resultados.map((p) => (
              <button
                key={p.sku}
                type="button"
                onClick={() => { onPick(p); setAbierto(false); }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors"
              >
                <ProductThumb src={p.imageUrl} alt={p.name} className="w-9 h-9" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    <code className="font-mono">{p.sku}</code>{p.variant ? ` · ${p.variant}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {p.price != null && <p>S/ {p.price.toFixed(2)}</p>}
                  <p>Stock {p.stock}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
