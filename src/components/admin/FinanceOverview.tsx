import { FinanceSummary } from "@/lib/admin-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote, CalendarCheck, Repeat, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface FinanceOverviewProps {
  summary?: FinanceSummary;
  isLoading: boolean;
}

const money = (n: number) =>
  `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
  return `${names[Number(m) - 1] ?? m} ${y.slice(2)}`;
};

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#FCCB34]/15 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[#FCCB34]" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl md:text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export function FinanceOverview({ summary, isLoading }: FinanceOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const chartData = summary.monthlyIncome.map((m) => ({
    month: monthLabel(m.month),
    total: m.total,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={CalendarCheck}
          label="Cobrado este mes"
          value={money(summary.monthCollected)}
        />
        <KpiCard
          icon={Repeat}
          label="Ingreso recurrente (MRR)"
          value={money(summary.mrr)}
          hint="Pagos recurrentes mensualizados"
        />
        <KpiCard
          icon={Banknote}
          label="Total histórico"
          value={money(summary.totalCollected)}
        />
        <KpiCard
          icon={Users}
          label="Clientes activos"
          value={`${summary.activeClients}`}
          hint={`${summary.totalClients} ${summary.totalClients === 1 ? "cuenta" : "cuentas"} en total`}
        />
      </div>

      <div className="glass rounded-2xl border border-border dark:border-white/10 p-5 md:p-6">
        <h3 className="font-semibold mb-1">Ingresos por mes</h3>
        <p className="text-xs text-muted-foreground mb-6">Últimos 12 meses</p>

        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            Aún no hay pagos registrados. Registra el primero desde la ficha de un cliente.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FCCB34" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#FCCB34" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `S/${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : v}`}
                />
                <Tooltip
                  formatter={(v: number) => [money(v), "Ingresos"]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid rgba(120,120,120,.25)",
                    background: "rgba(20,20,20,.92)",
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="total" stroke="#FCCB34" strokeWidth={2} fill="url(#incomeFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
