import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, AdminClient } from "@/lib/admin-api";
import { FinanceOverview } from "./FinanceOverview";
import { ClientsTable } from "./ClientsTable";
import { ClientDetailDialog } from "./ClientDetailDialog";
import { CreateClientDialog } from "./CreateClientDialog";
import { DeleteClientDialog } from "./DeleteClientDialog";
import { CrmModule } from "@/components/crm/CrmModule";
import { BillingModule } from "./BillingModule";
import { SignupRequests } from "./SignupRequests";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { Search, UserPlus } from "lucide-react";

export function AdminModule() {
  const { user } = useAuth();
  const isAccountant = user?.role === "contador";
  const [search, setSearch] = useState("");
  const [manageTarget, setManageTarget] = useState<AdminClient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminClient | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: financeResult, isLoading: loadingFinance } = useQuery({
    queryKey: ["admin-finance"],
    queryFn: () => adminApi.getFinanceSummary(),
    staleTime: 30_000,
  });

  const {
    data: clientsResult,
    isLoading: loadingClients,
    isError: clientsError,
  } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => adminApi.getClients(),
    staleTime: 30_000,
    enabled: !isAccountant,
  });

  const { data: signupsResult } = useQuery({
    queryKey: ["admin-signups", "pending"],
    queryFn: () => adminApi.getSignups("pending"),
    staleTime: 30_000,
    enabled: !isAccountant,
  });
  const pendientes = signupsResult?.data?.conteo?.pendientes ?? 0;

  const clients = clientsResult?.data ?? [];
  const term = search.trim().toLowerCase();
  const filtered = term
    ? clients.filter((c) =>
        [c.name, c.lastName, c.email, c.nameCompany, c.profile?.businessName, c.profile?.ruc]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term))
      )
    : clients;

  return (
    <div className="space-y-6">
      <Tabs defaultValue={isAccountant ? "facturacion" : "finanzas"}>
        <TabsList>
          <TabsTrigger value="finanzas">Finanzas</TabsTrigger>
          <TabsTrigger value="facturacion">Facturación</TabsTrigger>
          {!isAccountant && <TabsTrigger value="clientes">Clientes ({clients.length})</TabsTrigger>}
          {!isAccountant && (
            <TabsTrigger value="solicitudes">
              Solicitudes
              {pendientes > 0 && (
                <span className="ml-1.5 rounded-full bg-[#FCCB34] px-1.5 text-xs font-semibold text-[#111111]">{pendientes}</span>
              )}
            </TabsTrigger>
          )}
          {!isAccountant && <TabsTrigger value="crm">CRM</TabsTrigger>}
        </TabsList>

        <TabsContent value="facturacion" className="pt-6">
          <BillingModule />
        </TabsContent>

        <TabsContent value="finanzas" className="pt-6">
          <FinanceOverview summary={financeResult?.data} isLoading={loadingFinance} />
        </TabsContent>

        <TabsContent value="clientes" className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre, correo, razón social o RUC…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={() => setCreateOpen(true)} className="shrink-0">
              <UserPlus className="w-4 h-4 mr-2" />
              Nueva cuenta
            </Button>
          </div>

          <ClientsTable
            clients={filtered}
            isLoading={loadingClients}
            isError={clientsError}
            onManage={(c) => setManageTarget(c)}
            onDelete={(c) => setDeleteTarget(c)}
            currentUserId={user?.id}
          />
        </TabsContent>
        <TabsContent value="solicitudes" className="pt-6">
          <SignupRequests />
        </TabsContent>
        <TabsContent value="crm" className="pt-6">
          <CrmModule />
        </TabsContent>
      </Tabs>

      <ClientDetailDialog client={manageTarget} onClose={() => setManageTarget(null)} />
      <CreateClientDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <DeleteClientDialog client={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
