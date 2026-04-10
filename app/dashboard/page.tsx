import {
  BarChart2,
  DollarSign,
  FileText,
  TrendingUp,
  Users,
  AlertTriangle,
} from "lucide-react";
import { getDashboardInsights } from "@/app/actions";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { NarrativeSummary } from "@/components/dashboard/NarrativeSummary";
import { RefreshButton } from "@/components/dashboard/RefreshButton";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { AdvisorSelector } from "@/components/dashboard/AdvisorSelector";
import { AdvisorAlertWrapper } from "@/components/dashboard/AdvisorAlertWrapper";
import { FirstLoadTrigger } from "./FirstLoadTrigger";
import {
  getAdvisors,
  getAdvisorKpis,
  getAdvisorClients,
  getAdvisorBookStats,
} from "@/lib/advisor-data";

export const dynamic = "force-dynamic";

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  return `R${value.toLocaleString()}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const advisorId = parseInt((params?.advisor as string) ?? "1", 10);

  const [advisors, advisorKpis, clients, bookStats, fundInsights] = await Promise.all([
    getAdvisors(),
    getAdvisorKpis(advisorId),
    getAdvisorClients(advisorId),
    getAdvisorBookStats(advisorId),
    getDashboardInsights(),
  ]);

  const advisor = advisors.find((a) => a.advisor_id === advisorId) ?? advisors[0];

  if (!advisor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
        <FirstLoadTrigger />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Investment Advisor CRM</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {advisor.advisor_name} &middot; {advisor.branch} &middot; {advisor.region}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AdvisorSelector advisors={advisors} currentId={advisorId} />
          <RefreshButton generatedAt={fundInsights?.generated_at ?? null} />
        </div>
      </div>

      {/* AI Narrative (firm-wide cached, fixed token limit) */}
      {fundInsights?.insights && (
        <NarrativeSummary text={fundInsights.insights.narrative as unknown as string} />
      )}

      {/* KPI Cards — advisor-scoped, live SQL */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="My AUM"            value={formatZar(advisorKpis.my_aum)}                     icon={DollarSign} />
        <KpiCard label="Clients"           value={advisorKpis.client_count.toLocaleString()}          icon={Users} />
        <KpiCard label="Active Policies"   value={advisorKpis.active_policy_count.toLocaleString()}   icon={FileText} />
        <KpiCard label="Avg 1Y Return"     value={`${advisorKpis.avg_1y_return_pct.toFixed(1)}%`}     icon={TrendingUp} />
        <KpiCard label="Monthly Revenue"   value={formatZar(advisorKpis.monthly_revenue)}             icon={BarChart2} />
        <KpiCard label="At-Risk Clients"   value={advisorKpis.at_risk_count.toLocaleString()}         icon={AlertTriangle} />
      </div>

      {/* Advisor Alerts + Client Intelligence Table (interactive) */}
      <AdvisorAlertWrapper clients={clients} />

      {/* Tabbed Charts */}
      <DashboardTabs bookStats={bookStats} fundInsights={fundInsights?.insights ?? null} />
    </div>
  );
}
