import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Sale } from "@/lib/sync-api";

/** Estados en los que ya no hay nada que despachar: no se marca como urgente. */
const DONE = /shipped|delivered|canceled|cancelled|returned|failed|entregad|enviad|cancelad/i;

export const fmtDate = (iso: string | null | undefined, withTime = true) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};

/** Fecha máxima de envío con su urgencia: vencida, hoy, o los días que faltan. */
export function ShipByBadge({ sale }: { sale: Pick<Sale, "shipByDate" | "status" | "shipping"> }) {
  if (!sale.shipByDate) return <span className="text-muted-foreground">—</span>;
  const limite = new Date(sale.shipByDate).getTime();
  const horas = (limite - Date.now()) / 3_600_000;
  const cerrada = DONE.test(`${sale.status} ${sale.shipping?.status ?? ""}`);

  let clase = "bg-secondary text-muted-foreground border-border";
  let texto = fmtDate(sale.shipByDate, false);
  if (!cerrada) {
    if (horas < 0) { clase = "bg-red-500/10 text-red-400 border-red-500/30"; texto = "Vencida"; }
    else if (horas < 24) { clase = "bg-amber-500/10 text-amber-400 border-amber-500/30"; texto = "Hoy"; }
    else if (horas < 72) { clase = "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"; texto = `En ${Math.ceil(horas / 24)} días`; }
  }
  return (
    <div className="leading-tight">
      <Badge className={cn("text-[10px]", clase)}>{texto}</Badge>
      {texto !== fmtDate(sale.shipByDate, false) && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(sale.shipByDate, false)}</p>
      )}
    </div>
  );
}

export function StockCell({ value, low }: { value: number | null | undefined; low?: boolean }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  return <span className={cn("tabular-nums", low && value <= 5 && "text-amber-400 font-semibold")}>{value}</span>;
}
