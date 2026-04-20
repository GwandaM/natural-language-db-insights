import Link from "next/link";
import { AlertTriangle, DollarSign, FileText, TrendingUp, Users } from "lucide-react";
import { getAdvisors, getAdvisorClients, getAdvisorKpis } from "@/lib/advisor-data";
import { AdvisorSelector } from "@/components/dashboard/AdvisorSelector";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ClientDirectory } from "@/components/clients/ClientDirectory";
import { Button } from "@/components/ui/button";
import { Avatar, BrandBadge } from "@/components/brand";

function advisorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const dynamic = "force-dynamic";

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  return `R${value.toLocaleString()}`;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const advisorId = parseInt((params?.advisor as string) ?? "1", 10);

  const [advisors, clients, advisorKpis] = await Promise.all([
    getAdvisors(),
    getAdvisorClients(advisorId),
    getAdvisorKpis(advisorId),
  ]);

  const advisor = advisors.find((candidate) => candidate.advisor_id === advisorId) ?? advisors[0];

  if (!advisor) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <p className="text-muted-foreground">No advisors found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <BrandBadge size="lg" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Advisor cockpit</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Client Directory</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Full view of {advisor.advisor_name}&apos;s client book, with filters for priority work.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex flex-col items-end gap-2">
            <AdvisorSelector advisors={advisors} currentId={advisorId} />
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard?advisor=${advisorId}`}>Back to dashboard</Link>
            </Button>
          </div>
          <Avatar initials={advisorInitials(advisor.advisor_name)} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="My AUM" value={formatZar(advisorKpis.my_aum)} icon={DollarSign} />
        <KpiCard label="Clients" value={advisorKpis.client_count.toLocaleString()} icon={Users} />
        <KpiCard
          label="Active Policies"
          value={advisorKpis.active_policy_count.toLocaleString()}
          icon={FileText}
        />
        <KpiCard
          label="Avg 1Y Return"
          value={`${advisorKpis.avg_1y_return_pct.toFixed(1)}%`}
          icon={TrendingUp}
        />
        <KpiCard
          label="At-Risk Clients"
          value={advisorKpis.at_risk_count.toLocaleString()}
          icon={AlertTriangle}
        />
      </div>

      <ClientDirectory advisorId={advisorId} clients={clients} />
    </div>
  );
}
