import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { Sale, syncApi } from "@/lib/sync-api";
import { useStores } from "@/contexts/StoreContext";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { channelName, money } from "./format";
import { ProductThumb } from "./ProductThumb";
import { ShipByBadge, StockCell, fmtDate } from "./SaleParts";

interface Props {
  sale: Sale | null;
  onClose: () => void;
}

const Dato = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="min-w-0">
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <div className="text-sm break-words">{value ?? "—"}</div>
  </div>
);

const Bloque = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h3 className="text-sm font-semibold">{titulo}</h3>
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
  </section>
);

/** Panel con todo lo que se sabe de una venta: cliente, envío, pago y productos. */
export function OrderDetailSheet({ sale, onClose }: Props) {
  const { activeStore } = useStores();
  // El listado ya trae lo básico: se muestra al instante y el detalle completo llega después.
  const { data, isFetching } = useQuery({
    queryKey: ["sync-order", activeStore?.id, sale?.id],
    enabled: !!sale && !!activeStore,
    queryFn: async () => {
      const res = await syncApi.getSale(sale!.id);
      if (res.error || !res.data) throw new Error(res.error ?? "No se pudo cargar la venta");
      return res.data;
    },
    placeholderData: sale ?? undefined,
    staleTime: 30_000,
  });

  const s = data ?? sale;
  const d = s?.details ?? null;
  const sinPermiso = !!d && d.customer.phone === null && d.customer.email === null && d.customer.document === null && d.shipping.address.line === null;
  const dir = d?.shipping.address;
  const direccion = dir ? [dir.line, dir.city, dir.region, dir.postalCode, dir.country].filter(Boolean).join(", ") : "";

  return (
    <Sheet open={sale !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {s && (
          <div className="space-y-6">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                Pedido #{s.orderNumber}
                {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              </SheetTitle>
              <SheetDescription>
                {channelName(s.marketplace)}
                {s.account?.label ? ` · ${s.account.label}` : ""} · {fmtDate(s.orderDate)}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">{s.shipping?.status || s.status}</Badge>
              <span className="text-xs text-muted-foreground">Enviar antes de</span>
              <ShipByBadge sale={s} />
            </div>

            <div className="rounded-2xl bg-secondary/30 p-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total pagado</span>
              <span className="text-xl font-semibold tabular-nums">{money(s.totalAmount, s.currency)}</span>
            </div>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Productos</h3>
              {s.lines.map((l, i) => (
                <div key={i} className="rounded-xl border border-border p-3 space-y-3">
                  <div className="flex items-start gap-3">
                    <ProductThumb src={l.imageUrl} alt={l.title} className="w-14 h-14" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{l.productName || l.title}</p>
                      <code className="text-[11px] font-mono text-muted-foreground">{l.sku ?? "sin SKU"}</code>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm tabular-nums">{money(l.unitPrice * l.quantity, s.currency)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {l.quantity} × {money(l.unitPrice, s.currency)}
                      </p>
                      {l.listPrice != null && l.listPrice > l.unitPrice && (
                        <p className="text-[11px] text-muted-foreground line-through">{money(l.listPrice, s.currency)}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center rounded-lg bg-secondary/30 py-2">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Antes</p>
                      <StockCell value={l.stockBefore} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground flex items-center justify-center gap-1">
                        <ArrowRight className="w-3 h-3" /> Tras venta
                      </p>
                      <StockCell value={l.stockAfter} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Ahora</p>
                      <StockCell value={l.currentStock} low />
                    </div>
                  </div>
                  {(l.trackingCode || l.carrier || l.shippingAmount != null) && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      {l.carrier && <Dato label="Transportista" value={l.carrier} />}
                      {l.trackingCode && <Dato label="Seguimiento" value={<code>{l.trackingCode}</code>} />}
                      {l.shippingAmount != null && <Dato label="Costo de envío" value={money(l.shippingAmount, s.currency)} />}
                    </div>
                  )}
                </div>
              ))}
            </section>

            <Bloque titulo="Cliente">
              <Dato label="Nombre" value={s.customerName} />
              <Dato label="Documento" value={d?.customer.document} />
              <Dato label="Teléfono" value={d?.customer.phone} />
              <Dato label="Correo" value={d?.customer.email} />
              {d?.customer.nickname && <Dato label="Usuario en el canal" value={d.customer.nickname} />}
              {sinPermiso && (
                <p className="col-span-2 text-xs text-muted-foreground">
                  Con tu rol de lectura no ves el teléfono, correo, documento ni la dirección del cliente.
                </p>
              )}
            </Bloque>

            <Bloque titulo="Envío">
              <Dato label="Método" value={d?.shipping.method} />
              <Dato label="Estado" value={d?.shipping.status} />
              <Dato label="Enviar antes de" value={fmtDate(s.shipByDate)} />
              <Dato label="Entrega estimada" value={d?.shipping.deliveryBy ? fmtDate(d.shipping.deliveryBy, false) : null} />
              <Dato label="Transportista" value={d?.shipping.carrier} />
              <Dato label="Seguimiento" value={d?.shipping.trackingCode ? <code>{d.shipping.trackingCode}</code> : null} />
              <div className="col-span-2"><Dato label="Dirección" value={direccion || null} /></div>
              {dir?.receiver && <Dato label="Recibe" value={dir.receiver} />}
              {dir?.notes && <Dato label="Indicaciones" value={dir.notes} />}
            </Bloque>

            <Bloque titulo="Pago">
              <Dato label="Método" value={d?.payment.method} />
              <Dato label="Estado" value={d?.payment.status} />
              <Dato label="Monto" value={d?.payment.paidAmount != null ? money(d.payment.paidAmount, s.currency) : null} />
              <Dato label="Cuotas" value={d?.payment.installments} />
              {d?.payment.approvedAt && <Dato label="Aprobado" value={fmtDate(d.payment.approvedAt)} />}
            </Bloque>

            {d?.notes && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Notas del cliente</h3>
                <p className="text-sm text-muted-foreground">{d.notes}</p>
              </section>
            )}

            {!d && (
              <p className="text-xs text-muted-foreground">
                Esta venta se guardó antes de registrar sus detalles. Se completan solos en la próxima actualización de ventas.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
