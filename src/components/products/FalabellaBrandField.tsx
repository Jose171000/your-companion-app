import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncApi } from "@/lib/sync-api";

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

interface Props {
  productId: string;
  /** Marca con la que está hoy el producto. */
  value: string;
  /** Se llama con la marca ya guardada (tal como la escribe Falabella). */
  onSaved: (brand: string) => void;
}

/**
 * Falabella solo acepta marcas de su catálogo (o «GENERICO»). Se busca en ese catálogo y,
 * al elegir una, queda guardada en el producto; no se puede escribir una que no exista.
 */
export function FalabellaBrandField({ productId, value, onSaved }: Props) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const diferido = useDebounced(texto);

  const { data, isFetching } = useQuery({
    queryKey: ["falabella-brands", diferido],
    queryFn: () => syncApi.searchFalabellaBrands(diferido),
    enabled: abierto && diferido.trim().length >= 2,
    staleTime: 10 * 60_000,
  });
  const resultados = data?.data ?? [];

  const guardar = useMutation({
    mutationFn: (brand: string) => syncApi.setFalabellaBrand(productId, brand),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo guardar la marca");
      toast.success(`Marca guardada: ${res.data.brand}`);
      onSaved(res.data.brand);
      setTexto("");
      setAbierto(false);
    },
    onError: () => toast.error("No se pudo guardar la marca"),
  });

  return (
    <div className="space-y-1.5 min-w-0">
      <Label className="text-xs">Marca en Falabella</Label>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium break-words min-w-0">{value || "GENERICO"}</span>
        {guardar.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar otra marca (ej. Fisher-Price)…"
          value={texto}
          onFocus={() => setAbierto(true)}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
        />
      </div>
      {abierto && diferido.trim().length >= 2 && (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border/50">
          {isFetching ? (
            <p className="text-xs text-muted-foreground p-3">Buscando…</p>
          ) : resultados.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">
              Esa marca no está en el catálogo de Falabella. Prueba con otra o usa «GENERICO».
            </p>
          ) : (
            resultados.map((marca) => (
              <button
                key={marca}
                type="button"
                onClick={() => guardar.mutate(marca)}
                className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-sm hover:bg-secondary/40"
              >
                <span className="truncate">{marca}</span>
                {marca.toLowerCase() === (value || "").toLowerCase() && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
      {!abierto && (
        <button type="button" className="text-xs text-primary hover:underline" onClick={() => guardar.mutate("GENERICO")}>
          Usar «GENERICO» (sin marca)
        </button>
      )}
    </div>
  );
}
