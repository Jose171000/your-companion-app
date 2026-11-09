import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { GroupPrices, syncApi } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { channelName, money } from "./format";

interface PropioDeCanal { price: string; salePrice: string; saleStart: string; saleEnd: string }

const texto = (n: number | string | null | undefined) => (n === null || n === undefined ? "" : String(n));
const propioDe = (o: GroupPrices["canales"][number]["own"]): PropioDeCanal => ({ price: texto(o.price), salePrice: texto(o.salePrice), saleStart: texto(o.saleStart), saleEnd: texto(o.saleEnd) });
const numero = (v: string) => (v.trim() === "" ? null : Number(v));

/**
 * Los precios de TODAS las variantes de un grupo a la vez: el precio del producto (con el modo revisión queda en Revisión, agrupado)
 * y el precio y descuento propios de cada cuenta de canal (salen a su canal). Solo se aplica lo que se cambia.
 */
export function GroupPriceForm({ groupId, onDone }: { groupId: string; onDone?: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["group-prices", groupId],
    queryFn: () => syncApi.getGroupPrices(groupId),
    staleTime: 0,
  });
  const info = data?.data ?? null;

  const [precio, setPrecio] = useState("");
  const [canales, setCanales] = useState<Record<string, PropioDeCanal>>({});
  const original = useMemo(() => (info ? Object.fromEntries(info.canales.map((c) => [c.connectionId, propioDe(c.own)])) : {}), [info]);
  useEffect(() => {
    if (!info) return;
    setPrecio(info.price.comun !== null ? String(info.price.comun) : "");
    setCanales(original);
  }, [info, original]);

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ["group-prices", groupId] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["product-sheet"] });
    queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
    queryClient.invalidateQueries({ queryKey: ["sync-change-requests"] });
  };

  const n = info?.variantes ?? 0;
  const precioNum = numero(precio);
  const precioCambia = precioNum !== null && precioNum !== info?.price.comun;
  const precioInvalido = precioNum !== null && (Number.isNaN(precioNum) || precioNum <= 0);

  const guardarPrecio = useMutation({
    mutationFn: () => syncApi.updateGroupInventory(groupId, precioNum!),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudo guardar el precio");
      toast.success(res.data.message);
      refrescar();
      onDone?.();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  // Solo las cuentas cuyo precio o descuento cambió.
  const cambiosDeCanal = (info?.canales ?? [])
    .filter((c) => JSON.stringify(canales[c.connectionId]) !== JSON.stringify(original[c.connectionId]))
    .map((c) => {
      const v = canales[c.connectionId];
      return { connectionId: c.connectionId, price: numero(v.price), salePrice: numero(v.salePrice), saleStart: v.saleStart || null, saleEnd: v.saleEnd || null };
    });
  const canalInvalido = cambiosDeCanal.some((c) => [c.price, c.salePrice].some((x) => x !== null && (Number.isNaN(x) || x <= 0)));

  const guardarCanales = useMutation({
    mutationFn: () => syncApi.saveGroupChannelPrices(groupId, cambiosDeCanal),
    onSuccess: (res) => {
      if (res.error || !res.data) return toast.error(res.error ?? "No se pudieron guardar los precios");
      const d = res.data;
      toast.success(`Guardado en ${d.variantes} variantes. Se enviará a ${d.pricesSent.map((m) => channelName(m)).join(" y ") || "los canales"} en unos minutos.`);
      if (d.errores.length) toast.error(`${d.errores.length} variante(s) no cumplen: ${d.errores[0].mensaje}`);
      refrescar();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-28 w-full" /></div>;
  if (isError || !info) return <p className="text-sm text-destructive">No se pudieron cargar los precios del grupo.</p>;

  const set = (id: string, k: keyof PropioDeCanal, v: string) => setCanales((prev) => ({ ...prev, [id]: { ...prev[id], [k]: v } }));

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border p-3 space-y-2">
        <Label htmlFor={`gp-${groupId}`} className="text-sm font-medium">Precio del producto (las {n} variantes)</Label>
        <Input id={`gp-${groupId}`} type="number" min="0" step="0.01" value={precio} placeholder={info.price.comun === null ? "Distintos precios" : ""} onChange={(e) => setPrecio(e.target.value)} />
        <p className="text-[11px] text-muted-foreground">
          {info.price.distintos === 1
            ? `Hoy las ${n} variantes tienen ${money(info.price.comun)}.`
            : `Hoy hay ${info.price.distintos} precios distintos (${money(info.price.min)} a ${money(info.price.max)}). Al guardar, todas pasan al que escribas.`}
          {" "}Con el modo revisión encendido queda en Revisión, agrupado: apruebas las {n} con un clic.
        </p>
        <div className="flex justify-end">
          <Button size="sm" className="gap-1.5" disabled={!precioCambia || precioInvalido || guardarPrecio.isPending} onClick={() => guardarPrecio.mutate()}>
            {guardarPrecio.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar precio en las {n} variantes
          </Button>
        </div>
      </div>

      {info.canales.length > 0 && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Precio y descuento propios de cada canal</p>
            <p className="text-[11px] text-muted-foreground">Vacío usa el precio del producto. Se aplican a las variantes publicadas en esa cuenta y salen al canal sin pasar por revisión.</p>
          </div>
          {info.canales.map((c) => {
            const v = canales[c.connectionId] ?? propioDe(c.own);
            return (
              <div key={c.connectionId} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{channelName(c.marketplace)}</span>
                  <span className="text-xs text-muted-foreground">{c.account} · {c.variantes} variantes publicadas</span>
                </div>
                {c.differs && <p className="text-[11px] text-amber-500">Hoy las variantes tienen valores distintos aquí: al guardar se igualan al de abajo.</p>}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-normal text-muted-foreground">Precio solo en este canal</Label>
                    <Input type="number" min="0" step="0.01" value={v.price} onChange={(e) => set(c.connectionId, "price", e.target.value)} />
                  </div>
                  {c.canSetSale && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-normal text-muted-foreground">Precio con descuento</Label>
                        <Input type="number" min="0" step="0.01" value={v.salePrice} placeholder="Sin descuento" onChange={(e) => set(c.connectionId, "salePrice", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-normal text-muted-foreground">Descuento desde</Label>
                        <Input type="date" value={v.saleStart} onChange={(e) => set(c.connectionId, "saleStart", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-normal text-muted-foreground">Descuento hasta</Label>
                        <Input type="date" value={v.saleEnd} onChange={(e) => set(c.connectionId, "saleEnd", e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" disabled={!cambiosDeCanal.length || canalInvalido || guardarCanales.isPending} onClick={() => guardarCanales.mutate()}>
              {guardarCanales.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar precios de canal en las {n} variantes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
