import {
  BarChart2,
  DollarSign,
  FileText,
  Info,
  TrendingUp,
  Users,
  AlertTriangle,
} from "lucide-react";
import { getDashboardInsights } from "@/app/cockpit-actions";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { BriefingAccordion } from "@/components/dashboard/BriefingAccordion";
import { TodayActionsList, ActionCategory } from "@/components/dashboard/TodayActionsList";
import { PriorityClientsCard } from "@/components/dashboard/PriorityClientsCard";
import { RefreshButton } from "@/components/dashboard/RefreshButton";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { AdvisorSelector } from "@/components/dashboard/AdvisorSelector";
import { AdvisorAlertWrapper } from "@/components/dashboard/AdvisorAlertWrapper";
import { Avatar } from "@/components/brand";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { FirstLoadTrigger } from "./FirstLoadTrigger";
import {
  getAdvisors,
  getAdvisorKpis,
  getAdvisorClients,
  getAdvisorBookStats,
} from "@/lib/advisor-data";
import { summariseAdvisorProductSignals } from "@/lib/product-intelligence";
import { getPortfolioDeepDiveSnapshot } from "@/lib/portfolio-deepdive";

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

  const [
    advisors,
    advisorKpis,
    clients,
    bookStats,
    fundInsights,
    productSummary,
    portfolioDeepDive,
  ] = await Promise.all([
    getAdvisors(),
    getAdvisorKpis(advisorId),
    getAdvisorClients(advisorId),
    getAdvisorBookStats(advisorId),
    getDashboardInsights(advisorId),
    summariseAdvisorProductSignals(advisorId),
    getPortfolioDeepDiveSnapshot(advisorId, null),
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

  // ----- Today's Actions categorised counts -----
  const exploreNewBusiness = clients.filter(
    (client) => client.status === "active" && client.policy_count <= 1,
  ).length;
  const productFitReview = productSummary.fit_review_count;
  const investmentRiskMismatch = clients.filter((client) => client.has_risk_mismatch).length;
  const maturingPolicies = clients.filter(
    (client) =>
      client.is_post_retirement ||
      (client.years_to_retirement !== null && client.years_to_retirement <= 3),
  ).length;
  const sharedValueReview = clients.filter(
    (client) => client.status === "active" && client.policy_count >= 2,
  ).length;

  const actionCategories: ActionCategory[] = [
    {
      key: "explore_new_business",
      label: "Explore New Business Opportunities",
      count: exploreNewBusiness,
      href: `/clients?advisor=${advisorId}&focus=opportunity`,
    },
    {
      key: "product_fit_review",
      label: "Product Fit Review Recommended",
      count: productFitReview,
      href: `/clients?advisor=${advisorId}&focus=product_fit`,
    },
    {
      key: "investment_risk_mismatch",
      label: "Investment Risk Mismatch",
      count: investmentRiskMismatch,
      href: `/clients?advisor=${advisorId}&focus=risk_mismatch`,
    },
    {
      key: "maturing_policies",
      label: "Maturing Policies",
      count: maturingPolicies,
      href: `/clients?advisor=${advisorId}&focus=maturing`,
      highlight: true,
    },
    {
      key: "shared_value_review",
      label: "Shared Value Benefits Review",
      count: sharedValueReview,
      href: `/clients?advisor=${advisorId}&focus=shared_value`,
      highlight: true,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Hero header */}
      <header className="premium-card px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-3xl sm:text-[34px] font-bold tracking-tight text-foreground leading-tight">
              Investment Advisor CRM
            </h1>
            <p className="text-base sm:text-lg font-semibold text-foreground">
              Total AUM:{" "}
              <span className="brand-amount">{formatZarExact(advisorKpis.my_aum)}</span>
            </p>
            <p className="text-xs text-muted-foreground">As at {asAt}</p>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex flex-col items-end gap-2 text-right">
              <AdvisorSelector advisors={advisors} currentId={advisorId} />
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Info className="h-3 w-3" />
                {advisor.advisor_name} &middot; {advisor.branch}
              </p>
            </div>
            <Avatar initials={advisorInitials(advisor.advisor_name)} />
          </div>
        </div>
      </header>

      {!fundInsights?.insights ? (
        <div className="premium-card flex items-center justify-center min-h-[200px] py-10">
          <FirstLoadTrigger />
        </div>
      ) : (
        <>
          {/* Morning Briefing container */}
          <section className="premium-card px-5 py-5 sm:px-6 sm:py-6 space-y-4">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-0.5">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  Morning Briefing
                </h2>
                <p className="text-sm text-muted-foreground">
                  This is your daily briefing.
                </p>
              </div>
              <RefreshButton
                advisorId={advisorId}
                generatedAt={fundInsights?.generated_at ?? null}
              />
            </header>

            <BriefingAccordion
              briefing={fundInsights.insights.morning_briefing}
            />
          </section>

          {/* Priority Clients + Today's Actions — side by side */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PriorityClientsCard
              clients={fundInsights.insights.morning_briefing.priority_clients}
              advisorId={advisorId}
            />
            <TodayActionsList categories={actionCategories} />
          </div>
        </>
      )}

      {/* ── Secondary detail (collapsed by default) ── */}
      <CollapsibleSection
        title="Key Performance Indicators"
        description="Advisor-scoped metrics computed live from the book of business."
        rightSlot="6 metrics"
        padded={false}
        bodyClassName="px-5 py-4"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard label="My AUM"            value={formatZar(advisorKpis.my_aum)}                     icon={DollarSign} />
          <KpiCard label="Clients"           value={advisorKpis.client_count.toLocaleString()}          icon={Users} />
          <KpiCard label="Active Policies"   value={advisorKpis.active_policy_count.toLocaleString()}   icon={FileText} />
          <KpiCard label="Avg 1Y Return"     value={`${advisorKpis.avg_1y_return_pct.toFixed(1)}%`}     icon={TrendingUp} />
          <KpiCard label="Monthly Revenue"   value={formatZar(advisorKpis.monthly_revenue)}             icon={BarChart2} />
          <KpiCard label="At-Risk Clients"   value={advisorKpis.at_risk_count.toLocaleString()}         icon={AlertTriangle} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Client Intelligence"
        description="Alert filters and full client list ranked by AUM, commission or risk."
        rightSlot={`${clients.length} client${clients.length === 1 ? "" : "s"}`}
        padded={false}
        bodyClassName="px-5 py-4"
      >
        <AdvisorAlertWrapper advisorId={advisorId} clients={clients} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Analytics"
        description="Book-of-business and fund-level charts."
        padded={false}
        bodyClassName="px-5 py-4"
      >
        <DashboardTabs
          advisorId={advisorId}
          clients={clients}
          bookStats={bookStats}
          fundInsights={fundInsights?.insights ?? null}
          portfolioDeepDive={portfolioDeepDive}
        />
      </CollapsibleSection>
    </div>
  );
}
