import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Home,
  Layers,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { getFamilyDetail, getFamilyPolicyBreakdown, getFamilyWealthSplit } from "@/lib/family-data";
import { getFamilyInsightsAction } from "@/app/family-actions";
import { FamilyInsightCards } from "@/components/families/FamilyInsightCards";
import { getAdvisors } from "@/lib/advisor-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${value.toLocaleString()}`;
}

function formatZarExact(value: number): string {
  return `R ${value.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  primary: "Primary",
  spouse: "Spouse / Partner",
  child: "Child",
  parent: "Parent",
  sibling: "Sibling",
  other: "Other",
};

const LIFE_STAGE_LABELS: Record<string, string> = {
  pre_retirement: "Pre-retirement",
  post_retirement: "Post-retirement",
  mixed: "Mixed stages",
  education_focus: "Education focus",
};

const RISK_COLORS: Record<string, string> = {
  conservative: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  moderate: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  aggressive: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export default async function FamilyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ familyId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { familyId: familyIdStr } = await params;
  const resolvedSearchParams = await searchParams;
  const familyId = parseInt(familyIdStr, 10);
  const advisorId = parseInt((resolvedSearchParams?.advisor as string) ?? "1", 10);

  const [family, policyBreakdown, wealthSplit, advisors, storedInsights] = await Promise.all([
    getFamilyDetail(familyId),
    getFamilyPolicyBreakdown(familyId),
    getFamilyWealthSplit(familyId),
    getAdvisors(),
    getFamilyInsightsAction(advisorId, familyId),
  ]);

  if (!family) notFound();

  const advisor = advisors.find((a) => a.advisor_id === advisorId) ?? advisors[0];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Back link */}
      <Link
        href={`/families?advisor=${advisorId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Family Investing
      </Link>

      {/* Hero header */}
      <header className="premium-card px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]">
              <Home className="h-6 w-6" strokeWidth={2} />
            </span>
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {family.family_name}
              </h1>
              <p className="text-base font-semibold text-foreground">
                Combined AUM:{" "}
                <span className="brand-amount">{formatZarExact(family.combined_aum)}</span>
              </p>
              {family.family_goal && (
                <p className="text-sm text-muted-foreground">{family.family_goal}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
              <Users className="h-3 w-3" />
              {family.member_count} member{family.member_count !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
              <Layers className="h-3 w-3" />
              {family.total_policies} polic{family.total_policies !== 1 ? "ies" : "y"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--accent)/0.1)] px-3 py-1 text-xs font-medium text-[hsl(var(--accent))]">
              {LIFE_STAGE_LABELS[family.life_stage] ?? family.life_stage}
            </span>
          </div>
        </div>

        {/* Wrapper badges */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          {family.has_ra && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Retirement Annuity
            </span>
          )}
          {family.has_tfsa && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Tax-Free Savings
            </span>
          )}
          {family.has_living_annuity && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Living Annuity
            </span>
          )}
          {family.has_unit_trust && (
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              Unit Trust
            </span>
          )}
          {family.monthly_contributions > 0 && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Monthly contributions: {formatZar(family.monthly_contributions)}
            </span>
          )}
          {family.monthly_income > 0 && (
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
              Monthly income: {formatZar(family.monthly_income)}
            </span>
          )}
        </div>
      </header>

      {/* Members grid */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground px-1">
          Family Members
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {family.members.map((member) => (
            <Link
              key={member.client_id}
              href={`/clients/${member.client_id}?advisor=${advisorId}`}
              className="premium-card group flex flex-col gap-2.5 p-4 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary truncate">
                    {member.client_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {RELATIONSHIP_LABELS[member.relationship] ?? member.relationship}
                    {member.age !== null && ` · Age ${member.age}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {member.risk_profile && (
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        RISK_COLORS[member.risk_profile] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {member.risk_profile}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div>
                  <p className="text-muted-foreground">AUM</p>
                  <p className="font-semibold text-foreground tabular-nums">
                    {formatZar(member.total_aum)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">Policies</p>
                  <p className="font-semibold text-foreground">{member.policy_count}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">1Y Return</p>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {member.avg_1y_return_pct.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Wrapper tags */}
              {member.policy_types.length > 0 && (
                <div className="flex flex-wrap gap-1 border-t border-border pt-2">
                  {member.policy_types.slice(0, 4).map((type) => (
                    <span
                      key={type}
                      className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {type}
                    </span>
                  ))}
                  {member.policy_types.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{member.policy_types.length - 4} more
                    </span>
                  )}
                </div>
              )}

              {member.years_to_retirement !== null && !member.is_post_retirement && (
                <p className="text-[11px] text-muted-foreground border-t border-border pt-2 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {member.years_to_retirement} year{member.years_to_retirement !== 1 ? "s" : ""} to retirement
                </p>
              )}
              {member.is_post_retirement && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 border-t border-border pt-2 flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  Post-retirement
                </p>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Policy breakdown */}
      {policyBreakdown.length > 0 && (
        <section className="premium-card px-5 py-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Policy Structure
          </h2>
          <div className="divide-y divide-border">
            {policyBreakdown.map((row) => (
              <div
                key={row.policy_type}
                className="flex items-center justify-between py-2 text-xs"
              >
                <span className="text-foreground font-medium">{row.policy_type}</span>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>{row.count} polic{row.count !== 1 ? "ies" : "y"}</span>
                  <span className="font-semibold text-foreground tabular-nums w-24 text-right">
                    {formatZar(row.total_value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Wealth split */}
      {wealthSplit.length > 1 && (
        <section className="premium-card px-5 py-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Household Wealth Distribution
          </h2>
          <div className="space-y-2">
            {wealthSplit.map((row) => {
              const pct =
                family.combined_aum > 0
                  ? (row.total_value / family.combined_aum) * 100
                  : 0;
              return (
                <div key={row.member_name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground font-medium">{row.member_name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatZar(row.total_value)} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/40">
                    <div
                      className="h-1.5 rounded-full bg-[hsl(var(--brand-teal))]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* AI Family Insight Cards */}
      <FamilyInsightCards
        advisorId={advisorId}
        familyId={familyId}
        cards={storedInsights.insights?.cards ?? null}
        generatedAt={storedInsights.generated_at}
      />
    </div>
  );
}
