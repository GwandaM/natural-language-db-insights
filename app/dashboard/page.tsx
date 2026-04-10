import {
  BarChart2,
  DollarSign,
  FileText,
  Layers,
  TrendingUp,
  Users,
} from "lucide-react";
import { getDashboardInsights } from "@/app/actions";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { NarrativeSummary } from "@/components/dashboard/NarrativeSummary";
import { RefreshButton } from "@/components/dashboard/RefreshButton";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { FirstLoadTrigger } from "./FirstLoadTrigger";

export const dynamic = "force-dynamic";

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  return `R${value.toLocaleString()}`;
}

export default async function DashboardPage() {
  const { insights, generated_at } = await getDashboardInsights();

  if (!insights) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
        <FirstLoadTrigger />
      </div>
    );
  }

  const kpis = insights.kpis;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Investment Advisor CRM</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-generated insights across your book of business and fund universe
          </p>
        </div>
        <RefreshButton generatedAt={generated_at} />
      </div>

      {/* AI Narrative */}
      <NarrativeSummary text={insights.narrative as unknown as string} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Total AUM"
          value={formatZar(kpis.total_aum)}
          icon={DollarSign}
        />
        <KpiCard
          label="Total Clients"
          value={(kpis.total_clients * 5).toLocaleString()}
          icon={Users}
        />
        <KpiCard
          label="Active Policies"
          value={(kpis.active_policies * 5).toLocaleString()}
          icon={FileText}
        />
        <KpiCard
          label="Total Funds"
          value={kpis.total_funds.toLocaleString()}
          icon={Layers}
        />
        <KpiCard
          label="Avg 1Y Return"
          value={`${kpis.avg_1y_return.toFixed(1)}%`}
          icon={TrendingUp}
        />
        <KpiCard
          label="Monthly Revenue"
          value={formatZar(kpis.monthly_revenue * 5)}
          icon={BarChart2}
        />
      </div>

      {/* Tabbed Charts: Book of Business | Fund Analytics */}
      <DashboardTabs insights={insights} />
    </div>
  );
}
