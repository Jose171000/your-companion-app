import { AdminClient } from "@/lib/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Building2, Settings2, Users } from "lucide-react";

interface ClientsTableProps {
  clients: AdminClient[];
  isLoading: boolean;
  isError: boolean;
  onManage: (client: AdminClient) => void;
}

const money = (n: number) =>
  `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_STYLES: Record<string, string> = {
  activo: "bg-green-500/10 text-green-500 border-green-500/30",
  pausado: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  perdido: "bg-red-500/10 text-red-500 border-red-500/30",
};

export function ClientsTable({ clients, isLoading, isError, onManage }: ClientsTableProps) {
  if (isLoading) {
    return (
      <div className="glass rounded-2xl overflow-hidden divide-y divide-border/50">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass rounded-2xl flex flex-col items-center justify-center py-16 text-center">
        <Users className="w-12 h-12 text-muted-foreground mb-4 opacity-40" />
        <p className="font-semibold text-muted-foreground">Error al cargar los clientes</p>
        <p className="text-xs text-muted-foreground mt-1">Verifica que tu cuenta tenga rol de administrador.</p>
      </div>
    );
  }

  if (!clients.length) {
    return (
      <div className="glass rounded-2xl flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-muted-foreground opacity-50" />
        </div>
        <h3 className="text-base font-semibold mb-1">Aún no hay cuentas</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Cuando un cliente cree su cuenta en la plataforma, aparecerá aquí para que gestiones su plan y sus pagos.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              {["Cliente", "Tipo", "Estado", "Actividad", "Total pagado", ""].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-secondary/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#FCCB34]/20 text-[#111] dark:text-[#FCCB34] flex items-center justify-center text-xs font-bold shrink-0">
                      {(c.name?.[0] ?? "?").toUpperCase()}
                      {(c.lastName?.[0] ?? "").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate max-w-[220px]">
                        {c.profile?.businessName || `${c.name} ${c.lastName}`}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-[220px]">{c.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Building2 className="w-3 h-3" />
                    {c.profile?.clientType === "agency" ? "Agencia" : "Software"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    className={cn("text-[10px] capitalize", STATUS_STYLES[c.profile?.status ?? "activo"])}
                  >
                    {c.profile?.status ?? "activo"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {c.stats.products} productos · {c.stats.publishedListings} publicados
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {c.stats.connectedMarketplaces.length
                      ? c.stats.connectedMarketplaces.join(", ")
                      : "sin canales conectados"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold tabular-nums">{money(c.stats.totalPaid)}</p>
                  {c.stats.lastPaymentAt && (
                    <p className="text-[11px] text-muted-foreground">
                      último: {new Date(c.stats.lastPaymentAt).toLocaleDateString("es-PE")}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" onClick={() => onManage(c)}>
                    <Settings2 className="w-3.5 h-3.5 mr-2" />
                    Gestionar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-border/50">
        {clients.map((c) => (
          <div key={c.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm">{c.profile?.businessName || `${c.name} ${c.lastName}`}</p>
                <p className="text-xs text-muted-foreground truncate">{c.email}</p>
              </div>
              <Badge className={cn("text-[10px] capitalize shrink-0", STATUS_STYLES[c.profile?.status ?? "activo"])}>
                {c.profile?.status ?? "activo"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold tabular-nums">{money(c.stats.totalPaid)}</p>
              <Button variant="outline" size="sm" onClick={() => onManage(c)}>
                <Settings2 className="w-3.5 h-3.5 mr-2" />
                Gestionar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
