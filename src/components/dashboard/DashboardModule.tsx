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
import { cn } from "@/lib/utils";
import { Card, Kpi, LoadingGrid, SectionTitle } from "./DashboardParts";
import { ClientInsights } from "./ClientInsights";
import { NegocioView } from "./NegocioView";
import { AgencyControl } from "./AgencyControl";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Link2,
  Link2Off,
  Package,
  ShoppingCart,
} from "lucide-react";

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

  return <NegocioView s={data.data} />;
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

  const { cuentas } = data.data;

  return (
    <div className="space-y-4">
      <section>
        <SectionTitle
          title="Salud de las cuentas"
          subtitle="Canales caídos y publicaciones con error, quién necesita atención primero"
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
      {/* El superadmin ve primero la cartera (ventas, cobros y propuestas) y la salud de las cuentas; debajo, su propia cuenta. */}
      {esAdmin && (
        <>
          <section>
            <SectionTitle title="Control de la cartera" subtitle="Cuánto venden tus clientes, qué cobrarles y cuándo" />
            <AgencyControl />
          </section>
          <PanelDeAgencia />
        </>
      )}

      <section className="space-y-6">
        {esAdmin && <SectionTitle title="Tu cuenta" subtitle="El resumen de tu propio negocio" />}
        <MiNegocio />
        <ClientInsights />
      </section>
    </div>
  );
}
