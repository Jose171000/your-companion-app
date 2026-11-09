import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send, Trash2 } from "lucide-react";
import { UserListing, syncApi } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { channelName, money } from "./format";

interface Props {
  listing: UserListing;
  /** Descuento general del producto: si coincide con el del canal, de ahí salen las fechas. */
  promoDelProducto?: { price: number | null; start: string | null; end: string | null } | null;
}

/**
 * El descuento de UNA cuenta de Falabella o Ripley: lo que el canal muestra hoy y el que se quiere mandar. Cada canal guarda sus
 * precios a su manera (la lista de Ripley puede ser distinta a la de Falabella), por eso el descuento es por cuenta.
 * Falabella sale al instante; Ripley pasa por Revisión y puede quitarse desde aquí.
 */
export function ChannelPromoBlock({ listing: l, promoDelProducto }: Props) {
  const queryClient = useQueryClient();
  const esRipley = l.marketplace === "ripley";
  const actual = l.salePrice != null ? Number(l.salePrice) : null;
  const lista = l.regularPrice ?? l.lastPriceSynced ?? null;
  const fechasDeSynkro = promoDelProducto?.price != null && actual !== null && Number(promoDelProducto.price) === actual;
  const inicialDesde = fechasDeSynkro ? promoDelProducto?.start ?? "" : "";
  const inicialHasta = fechasDeSynkro ? promoDelProducto?.end ?? "" : "";

  const [precio, setPrecio] = useState(actual !== null ? String(actual) : "");
  const [desde, setDesde] = useState(inicialDesde);
  const [hasta, setHasta] = useState(inicialHasta);
  useEffect(() => {
    setPrecio(actual !== null ? String(actual) : "");
    setDesde(inicialDesde);
    setHasta(inicialHasta);
  }, [l.id, actual, inicialDesde, inicialHasta]);

  const num = precio === "" ? null : Number(precio);
  const fechasMal = desde !== "" && hasta !== "" && hasta < desde;
  const invalido = num !== null && (Number.isNaN(num) || num <= 0 || (lista !== null && num >= Number(lista)));
  const cambio = num !== actual || desde !== inicialDesde || hasta !== inicialHasta;

  const enviar = useMutation({
    mutationFn: (quitar: boolean) =>
      syncApi.setListingPromo(l.id, quitar ? { salePrice: null } : { salePrice: num, saleStart: desde || null, saleEnd: hasta || null }),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error); return; }
      toast.success(res.data?.message ?? "Descuento enviado");
      queryClient.invalidateQueries({ queryKey: ["sync-listings"] });
      queryClient.invalidateQueries({ queryKey: ["sync-change-requests"] });
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const nombre = `${channelName(l.marketplace)}${l.accountLabel ? ` · ${l.accountLabel}` : ""}`;
  const id = `promo-${l.id}`;

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{nombre}</p>
        <p className="text-[11px] text-muted-foreground text-right">
          Hoy: lista {lista != null ? money(lista, l.currency) : "—"} ·{" "}
          {actual !== null ? <span className="text-foreground font-medium">descuento {money(actual, l.currency)}</span> : "sin descuento"}
        </p>
      </div>

      <Label htmlFor={id} className="text-xs">Descuento para esta cuenta</Label>
      <Input id={id} type="number" min={0} step="0.01" placeholder="Sin descuento" value={precio} onChange={(e) => setPrecio(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-d`} className="text-xs">Desde (opcional)</Label>
          <Input id={`${id}-d`} type="date" value={desde} onChange={(e) => setDesde(e.target.value)} disabled={precio === ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-h`} className="text-xs">Hasta (opcional)</Label>
          <Input id={`${id}-h`} type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} disabled={precio === ""} />
        </div>
      </div>

      {invalido || fechasMal ? (
        <p className="text-[11px] text-red-400">
          {invalido ? `El descuento debe ser mayor que 0 y menor que la lista${lista != null ? ` (${money(lista, l.currency)})` : ""}. ` : ""}
          {fechasMal ? "La fecha final no puede ser anterior a la inicial." : ""}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {esRipley
            ? "Solo cambia el descuento: el stock y el precio de lista de Ripley no se tocan. Con el modo revisión encendido queda pendiente en Revisión."
            : "Se envía a Falabella al instante, como precio especial. Para quitarlo, hazlo en el Seller Center."}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {esRipley && actual !== null && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-red-400" disabled={enviar.isPending} onClick={() => enviar.mutate(true)}>
            <Trash2 className="w-3.5 h-3.5" /> Quitar descuento
          </Button>
        )}
        <Button type="button" size="sm" className="gap-1.5" disabled={enviar.isPending || num === null || invalido || fechasMal || !cambio} onClick={() => enviar.mutate(false)}>
          {enviar.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Enviar a {channelName(l.marketplace)}
        </Button>
      </div>
    </div>
  );
}
