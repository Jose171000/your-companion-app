import { Badge } from "@/components/ui/badge";
import { channelName } from "@/components/marketplaces/format";

export interface ResumenDeEnvio {
  paidTotal: number;
  byType: { type: "comprador" | "gratis" | "retiro" | "sin_dato"; orders: number; paid: number; sellerCost: number; ordersWithCost: number }[];
  byChannel: { channel: string; type: string; orders: number; paid: number; sellerCost: number; ordersWithCost: number }[];
}

export interface ResumenDeCupones {
  orders: number;
  amount: number;
  sellerFunded: number;
  ordersWithKnownFunding: number;
  byChannel: { channel: string; orders: number; amount: number; sellerFunded: number; ordersWithKnownFunding: number }[];
}

const money = (n: number) => `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pedidos = (n: number) => `${n} ${n === 1 ? "pedido" : "pedidos"}`;

function Fila({ titulo, detalle, derecha, nota }: { titulo: string; detalle?: string; derecha: string; nota?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <p className="font-medium text-sm">{titulo}</p>
        {detalle && <p className="text-[11px] text-muted-foreground">{detalle}</p>}
        {nota && <p className="text-[11px] text-muted-foreground mt-0.5">{nota}</p>}
      </div>
      <p className="font-semibold text-sm tabular-nums text-right shrink-0">{derecha}</p>
    </div>
  );
}

/**
 * Costos de envío: lo que pagó el comprador y los envíos gratis (con lo que te costaron a ti cuando el canal lo informa:
 * hoy Mercado Libre; Falabella no informa lo que te cobra). Y los cupones y descuentos que aplicó cada canal.
 */
export function EnviosYCupones({ envio, cupones, incluirEnvio }: { envio: ResumenDeEnvio; cupones: ResumenDeCupones; incluirEnvio: boolean }) {
  const tipo = (t: string) => envio.byType.find((x) => x.type === t);
  const comprador = tipo("comprador");
  const gratis = tipo("gratis");
  const retiro = tipo("retiro");
  const sinDato = tipo("sin_dato");
  const hay = envio.byType.some((t) => t.orders > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
        <h3 className="font-semibold mb-1">Costos de envío</h3>
        <p className="text-xs text-muted-foreground mb-3">Quién pagó el envío en los pedidos del periodo</p>

        {!hay ? (
          <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">Sin pedidos en este periodo.</div>
        ) : (
          <>
            <Fila
              titulo="Envío pagado por el comprador"
              detalle={pedidos(comprador?.orders ?? 0)}
              derecha={money(comprador?.paid ?? 0)}
              nota={incluirEnvio ? "Incluido en las ventas del periodo." : "No incluido en las ventas (el interruptor «Incluir envío» está apagado)."}
            />
            <Fila
              titulo="Envío gratis para el comprador"
              detalle={pedidos(gratis?.orders ?? 0)}
              derecha={(gratis?.ordersWithCost ?? 0) > 0 ? money(gratis!.sellerCost) : "—"}
              nota={
                (gratis?.orders ?? 0) === 0
                  ? undefined
                  : (gratis?.ordersWithCost ?? 0) > 0
                    ? `Costo para ti en ${gratis!.ordersWithCost} de ${gratis!.orders} pedidos: es lo que el canal informa. En los demás el canal no informa cuánto te costó el envío.`
                    : "El canal no informa cuánto te costó el envío (Falabella no lo trae en el pedido)."
              }
            />
            <Fila titulo="Retiro en tienda (sin envío)" detalle={pedidos(retiro?.orders ?? 0)} derecha="—" />
            {(sinDato?.orders ?? 0) > 0 && (
              <Fila titulo="Sin dato de envío" detalle={pedidos(sinDato!.orders)} derecha="—" nota="Pedidos anteriores o de canales que no informan el envío." />
            )}

            {envio.byChannel.length > 0 && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Ver por canal</summary>
                <div className="mt-2 space-y-1">
                  {envio.byChannel.filter((c) => c.orders > 0).map((c) => (
                    <div key={`${c.channel}-${c.type}`} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {channelName(c.channel)} · <Badge variant="secondary" className="text-[10px]">{({ comprador: "pagado por el comprador", gratis: "gratis", retiro: "retiro", sin_dato: "sin dato" } as Record<string, string>)[c.type] ?? c.type}</Badge>
                      </span>
                      <span className="tabular-nums text-muted-foreground shrink-0">
                        {pedidos(c.orders)}{c.paid > 0 ? ` · ${money(c.paid)}` : ""}{c.ordersWithCost > 0 ? ` · costo ${money(c.sellerCost)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>

      <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
        <h3 className="font-semibold mb-1">Cupones y descuentos</h3>
        <p className="text-xs text-muted-foreground mb-3">Lo que el canal le descontó al comprador en los pedidos del periodo</p>

        {cupones.orders === 0 ? (
          <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">Sin cupones ni descuentos en este periodo.</div>
        ) : (
          <>
            <Fila titulo="Total en cupones y descuentos" detalle={pedidos(cupones.orders)} derecha={money(cupones.amount)} />
            <Fila
              titulo="Parte que cubres tú"
              derecha={cupones.ordersWithKnownFunding > 0 ? money(cupones.sellerFunded) : "—"}
              nota={
                cupones.ordersWithKnownFunding > 0
                  ? `Solo en los ${cupones.ordersWithKnownFunding} pedidos donde el canal informa quién cubre el descuento.`
                  : "El canal no informa quién cubre estos descuentos."
              }
            />
            {cupones.byChannel.length > 0 && (
              <div className="mt-3 space-y-1 text-xs">
                {cupones.byChannel.map((c) => (
                  <div key={c.channel} className="flex items-center justify-between gap-2">
                    <span>{channelName(c.channel)}</span>
                    <span className="tabular-nums text-muted-foreground">{pedidos(c.orders)} · {money(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
