import { useQuery } from "@tanstack/react-query";
import { useStores } from "@/contexts/StoreContext";
import {
  dashboardApi,
  DashboardAccount,
  MARKETPLACE_LABEL,
  money,
} from "@/lib/dashboard-api";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Link2,
  Link2Off,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

// ─── Piezas ───────────────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("glass rounded-2xl border border-border p-4 md:p-5", className)}>
      {children}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-2xl md:text-3xl font-bold tracking-tight mt-1 truncate",
              tone === "warning" && "text-amber-500",
              tone === "danger" && "text-destructive"
            )}
          >
            {value}
          </p>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            tone === "warning" ? "bg-amber-500/10" : tone === "danger" ? "bg-destructive/10" : "bg-primary/10"
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h3 className="font-semibold text-base md:text-lg">{title}</h3>
      {subtitle && <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20 mt-2" />
        </Card>
      ))}
    </div>
  );
}

// ─── Resumen del negocio propio ───────────────────────────────────────────────

function MiNegocio() {
  // El resumen es de la tienda activa: cada tienda tiene sus propios canales y ventas.
  const { activeStore } = useStores();
  const storeId = activeStore?.id;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-summary", storeId],
    enabled: !!storeId,
    queryFn: () => dashboardApi.getSummary(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  if (isLoading) return <LoadingGrid />;
  if (isError || !data?.data) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          No se pudo cargar el resumen. Reintenta en unos segundos.
        </p>
      </Card>
    );
  }

  const s = data.data;
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
                <span
                  className={cn(
                    "flex items-center gap-0.5 font-medium",
                    variacion >= 0 ? "text-green-500" : "text-destructive"
                  )}
                >
                  {variacion >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
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
          hint={
            s.catalogo.conError
              ? "Revísalas en Marketplaces"
              : s.catalogo.pendientes
                ? `${s.catalogo.pendientes} en proceso`
                : "Sin incidencias"
          }
          tone={s.catalogo.conError ? "danger" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Canales */}
        <section>
          <SectionTitle title="Tus canales" subtitle="Estado de cada cuenta conectada" />
          <Card>
            {s.canales.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Todavía no has conectado ningún canal. Ve a Marketplaces para empezar.
              </p>
            ) : (
              <div className="divide-y divide-border/50 -my-2">
                {s.canales.map((c) => {
                  const ventas = s.ventas.porCanal.find((v) => v.marketplace === c.marketplace);
                  return (
                    <div key={c.marketplace} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {MARKETPLACE_LABEL[c.marketplace] ?? c.marketplace}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{c.nickname}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {ventas && (
                          <span className="text-xs text-muted-foreground">
                            {money(ventas.importe)} · {ventas.pedidos}
                          </span>
                        )}
                        {c.status === "active" ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/30 text-[10px]">
                            Conectado
                          </Badge>
                        ) : (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                            Reconectar
                          </Badge>
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
              <p className="text-sm text-muted-foreground py-2">
                Ningún producto publicado está por agotarse.
              </p>
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

// ─── Panel de agencia ─────────────────────────────────────────────────────────

function FilaCuenta({ cuenta }: { cuenta: DashboardAccount }) {
  const necesitaAtencion =
    cuenta.canalesCaidos > 0 || cuenta.publicaciones.conError > 0 || cuenta.problemasSinLeer > 0;

  return (
    <div
      className={cn(
        "grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-xl text-sm",
        necesitaAtencion && "bg-destructive/5"
      )}
    >
      <div className="col-span-12 md:col-span-4 min-w-0">
        <p className="font-medium truncate">{cuenta.empresa || cuenta.nombre}</p>
        <p className="text-xs text-muted-foreground truncate">{cuenta.email}</p>
      </div>

      <div className="col-span-6 md:col-span-3 flex flex-wrap gap-1">
        {cuenta.canales.length === 0 ? (
          <span className="text-xs text-muted-foreground">Sin canales</span>
        ) : (
          cuenta.canales.map((c) => (
            <Badge
              key={c.marketplace}
              variant="outline"
              className={cn(
                "text-[10px]",
                c.status === "active"
                  ? "border-green-500/30 text-green-500"
                  : "border-destructive/30 text-destructive"
              )}
            >
              {MARKETPLACE_LABEL[c.marketplace] ?? c.marketplace}
            </Badge>
          ))
        )}
      </div>

      <div className="col-span-3 md:col-span-2 text-right md:text-left">
        <p className="font-medium">{money(cuenta.ventas.importe)}</p>
        <p className="text-xs text-muted-foreground">{cuenta.ventas.pedidos} ped.</p>
      </div>

      <div className="col-span-3 md:col-span-1 text-right md:text-left">
        <p className="font-medium">{cuenta.publicaciones.publicados}</p>
        <p className="text-xs text-muted-foreground">activas</p>
      </div>

      <div className="col-span-12 md:col-span-2 flex md:justify-end gap-1 flex-wrap">
        {cuenta.canalesCaidos > 0 && (
          <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
            {cuenta.canalesCaidos} canal caído
          </Badge>
        )}
        {cuenta.publicaciones.conError > 0 && (
          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]">
            {cuenta.publicaciones.conError} con error
          </Badge>
        )}
        {!necesitaAtencion && (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/30 text-[10px]">
            Al día
          </Badge>
        )}
      </div>
    </div>
  );
}

function PanelDeAgencia() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-accounts"],
    queryFn: () => dashboardApi.getAccounts(),
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingGrid />;
  if (isError || !data?.data) return null;

  const { cuentas, totales } = data.data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Kpi icon={<Users className="w-5 h-5 text-primary" />} label="Clientes" value={String(totales.clientes)} />
        <Kpi
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
          label="Ventas del mes (todos)"
          value={money(totales.importe)}
          hint={`${totales.pedidos} pedidos`}
        />
        <Kpi
          icon={<AlertTriangle className="w-5 h-5 text-destructive" />}
          label="Cuentas que necesitan atención"
          value={String(
            cuentas.filter(
              (c) => c.canalesCaidos > 0 || c.publicaciones.conError > 0 || c.problemasSinLeer > 0
            ).length
          )}
          tone="danger"
        />
      </div>

      <section>
        <SectionTitle
          title="Tus clientes"
          subtitle="Ordenados por quién necesita atención primero"
        />
        <Card className="p-2 md:p-3">
          {cuentas.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">
              Todavía no hay clientes registrados.
            </p>
          ) : (
            <div className="space-y-1">
              {cuentas.map((c) => (
                <FilaCuenta key={c.id} cuenta={c} />
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

// ─── Módulo ───────────────────────────────────────────────────────────────────

export function DashboardModule() {
  const { user } = useAuth();
  const esAdmin = user?.role === "admin";

  return (
    <div className="space-y-8">
      {/* El admin ve primero cómo va la cartera, y debajo su propia cuenta. */}
      {esAdmin && <PanelDeAgencia />}

      <section>
        {esAdmin && <SectionTitle title="Tu cuenta" subtitle="El resumen de tu propio negocio" />}
        <MiNegocio />
      </section>
    </div>
  );
}
