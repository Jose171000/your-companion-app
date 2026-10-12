import { DashboardSummary, MARKETPLACE_LABEL, money } from "@/lib/dashboard-api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Link2, Link2Off, Package, ShoppingCart } from "lucide-react";
import { Card, Kpi, SectionTitle } from "./DashboardParts";

/**
 * El resumen del negocio de una tienda: ventas del mes, publicaciones, canales y
 * stock en riesgo. Es solo la vista: la usan el dashboard del cliente y la ficha
 * que ve el superadmin de cada cliente, para que sea exactamente lo mismo.
 */
export function NegocioView({ s }: { s: DashboardSummary }) {
  const caidos = s.canales.filter((c) => c.status !== "active").length;
  const variacion = s.ventas.variacion;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi
          icon={<ShoppingCart className="w-5 h-5 text-primary" />}
          label="Ventas este mes"
          value={money(s.ventas.mes.importe)}
          hint={
            <span className="flex items-center gap-1">
              {s.ventas.mes.pedidos} {s.ventas.mes.pedidos === 1 ? "pedido" : "pedidos"}
              {variacion !== null && (
                <span className={cn("flex items-center gap-0.5 font-medium", variacion >= 0 ? "text-green-500" : "text-destructive")}>
                  {variacion >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(variacion)}%
                </span>
              )}
            </span>
          }
        />
        <Kpi
          icon={<Package className="w-5 h-5 text-primary" />}
          label="Publicaciones activas"
          value={String(s.catalogo.publicados)}
          hint={`${s.catalogo.total} productos en catálogo`}
        />
        <Kpi
          icon={caidos ? <Link2Off className="w-5 h-5 text-destructive" /> : <Link2 className="w-5 h-5 text-primary" />}
          label="Canales conectados"
          value={String(s.canales.length - caidos)}
          hint={caidos ? `${caidos} necesita reconexión` : "Todos funcionando"}
          tone={caidos ? "danger" : "default"}
        />
        <Kpi
          icon={<AlertTriangle className={cn("w-5 h-5", s.catalogo.conError ? "text-destructive" : "text-primary")} />}
          label="Publicaciones con error"
          value={String(s.catalogo.conError)}
          hint={s.catalogo.conError ? "Revísalas en Marketplaces" : s.catalogo.pendientes ? `${s.catalogo.pendientes} en proceso` : "Sin incidencias"}
          tone={s.catalogo.conError ? "danger" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Canales */}
        <section>
          <SectionTitle title="Canales" subtitle="Estado de cada cuenta conectada" />
          <Card>
            {s.canales.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Todavía no hay ningún canal conectado.</p>
            ) : (
              <div className="divide-y divide-border/50 -my-2">
                {s.canales.map((c, i) => {
                  const ventas = s.ventas.porCanal.find((v) => v.marketplace === c.marketplace);
                  return (
                    <div key={`${c.marketplace}-${c.nickname}-${i}`} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{MARKETPLACE_LABEL[c.marketplace] ?? c.marketplace}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.nickname}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {ventas && (
                          <span className="text-xs text-muted-foreground">
                            {money(ventas.importe)} · {ventas.pedidos}
                          </span>
                        )}
                        {c.status === "active" ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/30 text-[10px]">Conectado</Badge>
                        ) : (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">Reconectar</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </section>

        {/* Stock en riesgo */}
        <section>
          <SectionTitle title="Stock por agotarse" subtitle="Productos publicados con pocas unidades" />
          <Card>
            {s.stockBajo.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Ningún producto publicado está por agotarse.</p>
            ) : (
              <div className="divide-y divide-border/50 -my-2">
                {s.stockBajo.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sku}</p>
                    </div>
                    <Badge
                      className={cn(
                        "text-[10px] shrink-0",
                        p.stock === 0
                          ? "bg-destructive/10 text-destructive border-destructive/30"
                          : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                      )}
                    >
                      {p.stock === 0 ? "Sin stock" : `${p.stock} u.`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
