import {
  BarChart2,
  DollarSign,
  FileText,
  TrendingUp,
  Users,
  AlertTriangle,
} from "lucide-react";
import { getDashboardInsights } from "@/app/cockpit-actions";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { NarrativeSummary } from "@/components/dashboard/NarrativeSummary";
import { RefreshButton } from "@/components/dashboard/RefreshButton";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { AdvisorSelector } from "@/components/dashboard/AdvisorSelector";
import { AdvisorAlertWrapper } from "@/components/dashboard/AdvisorAlertWrapper";
import { TodayActions } from "@/components/dashboard/TodayActions";
import { PriorityClientList } from "@/components/dashboard/PriorityClientList";
import { Avatar } from "@/components/brand";
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

function formatZarExact(value: number): string {
  return `R ${value.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function advisorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
    getDashboardInsights(advisorId),
  ]);

  const advisor = advisors.find((a) => a.advisor_id === advisorId) ?? advisors[0];

  if (!advisor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
        <FirstLoadTrigger />
      </div>
    );
  }

  const asAt = new Date().toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Investment Advisor CRM
          </h1>
          <p className="text-base sm:text-lg font-semibold text-primary">
            Total AUM: <span className="brand-amount">{formatZarExact(advisorKpis.my_aum)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {advisor.advisor_name} &middot; {advisor.branch} &middot; {advisor.region} &middot; as at {asAt}
          </p>
        </div>
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-end gap-2">
            <AdvisorSelector advisors={advisors} currentId={advisorId} />
            <RefreshButton
              advisorId={advisorId}
              generatedAt={fundInsights?.generated_at ?? null}
            />
          </div>
          <Avatar initials={advisorInitials(advisor.advisor_name)} />
        </div>
      </div>

      {!fundInsights?.insights ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <FirstLoadTrigger />
        </div>
      ) : (
        <>
          <NarrativeSummary briefing={fundInsights.insights.morning_briefing} />

          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
            <TodayActions
              advisorId={advisorId}
              actions={fundInsights.insights.morning_briefing.today_actions}
            />
            <PriorityClientList
              advisorId={advisorId}
              clients={fundInsights.insights.morning_briefing.priority_clients}
            />
          </div>
        </>
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
      <AdvisorAlertWrapper advisorId={advisorId} clients={clients} />

      {/* Tabbed Charts */}
      <DashboardTabs bookStats={bookStats} fundInsights={fundInsights?.insights ?? null} />
    </div>
  );
}
