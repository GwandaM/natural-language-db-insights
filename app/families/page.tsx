import Link from "next/link";
import {
  BookOpen,
  Home,
  Info,
  Layers,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { getAdvisors, getAdvisorKpis } from "@/lib/advisor-data";
import { getFamiliesByAdvisor } from "@/lib/family-data";
import { AdvisorSelector } from "@/components/dashboard/AdvisorSelector";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Avatar, BrandBadge } from "@/components/brand";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${value.toLocaleString()}`;
}

function advisorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const LIFE_STAGE_LABELS: Record<string, string> = {
  pre_retirement: "Pre-retirement",
  post_retirement: "Post-retirement",
  mixed: "Mixed",
  education_focus: "Education focus",
};

const LIFE_STAGE_COLORS: Record<string, string> = {
  pre_retirement: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  post_retirement: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  mixed: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  education_focus: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export default async function FamiliesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const advisorId = parseInt((params?.advisor as string) ?? "1", 10);

  const [advisors, kpis, families] = await Promise.all([
    getAdvisors(),
    getAdvisorKpis(advisorId),
    getFamiliesByAdvisor(advisorId),
  ]);

  const advisor = advisors.find((a) => a.advisor_id === advisorId) ?? advisors[0];

  if (!advisor) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <p className="text-muted-foreground">No advisors found.</p>
      </div>
    );
  }

  const totalFamilyAum = families.reduce((s, f) => s + f.combined_aum, 0);
  const totalPolicies = families.reduce((s, f) => s + f.policy_count, 0);
  const avgReturn =
    families.length > 0
      ? families.reduce((s, f) => s + f.avg_1y_return_pct, 0) / families.length
      : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <BrandBadge size="lg" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Advisor cockpit
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Family Investing
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Household-level wealth, life stage planning, and intergenerational insights.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <AdvisorSelector advisors={advisors} currentId={advisorId} />
            <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
              <Info className="h-3 w-3" />
              {advisor.advisor_name} &middot; {advisor.branch}
            </p>
          </div>
          <Avatar initials={advisorInitials(advisor.advisor_name)} />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Family Units" value={families.length.toString()} icon={Home} />
        <KpiCard label="Combined AUM" value={formatZar(totalFamilyAum)} icon={BookOpen} />
        <KpiCard label="Total Policies" value={totalPolicies.toString()} icon={Layers} />
        <KpiCard label="Avg 1Y Return" value={`${avgReturn.toFixed(1)}%`} icon={TrendingUp} />
      </div>

      {/* Family grid */}
      {families.length === 0 ? (
        <div className="premium-card px-6 py-12 text-center text-muted-foreground">
          <p className="text-sm">No family units found for this advisor.</p>
          <p className="text-xs mt-1">Run the database migration to create family groupings from existing clients.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {families.map((family) => (
            <Link
              key={family.family_id}
              href={`/families/${family.family_id}?advisor=${advisorId}`}
              className="premium-card group flex flex-col gap-3 p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* Family name + life stage badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]">
                    <Home className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <h2 className="text-sm font-semibold text-foreground truncate group-hover:text-primary">
                    {family.family_name}
                  </h2>
                </div>
                <span
                  className={cn(
                    "inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    LIFE_STAGE_COLORS[family.life_stage] ?? LIFE_STAGE_COLORS.mixed,
                  )}
                >
                  {LIFE_STAGE_LABELS[family.life_stage] ?? family.life_stage}
                </span>
              </div>

              {/* AUM + policy count */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Combined AUM</p>
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    {formatZar(family.combined_aum)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">1Y Return</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {family.avg_1y_return_pct.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Members + wrapper badges */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {family.member_count} member{family.member_count !== 1 ? "s" : ""}
                  &nbsp;&middot;&nbsp;
                  {family.policy_count} polic{family.policy_count !== 1 ? "ies" : "y"}
                </span>
                <span className="flex items-center gap-1">
                  {family.has_ra && (
                    <span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">
                      RA
                    </span>
                  )}
                  {family.has_tfsa && (
                    <span className="rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      TFSA
                    </span>
                  )}
                  {family.has_living_annuity && (
                    <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      LA
                    </span>
                  )}
                </span>
              </div>

              {/* Goal excerpt */}
              {family.family_goal && (
                <p className="text-xs text-muted-foreground line-clamp-1 border-t border-border pt-2">
                  {family.family_goal}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
