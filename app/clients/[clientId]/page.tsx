import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Info,
  Mail,
  Phone,
  PieChart,
} from "lucide-react";
import {
  buildWrapperAlerts,
  getClientCommunicationDrafts,
  getClientDetail,
  getClientWrappers,
} from "@/lib/advisor-data";
import { getClientCommissionCalculation } from "@/lib/commission-data";
import { getClientProductIntelligence } from "@/lib/product-intelligence";
import { CommunicationWorkspace } from "@/components/clients/CommunicationWorkspace";
import { CommissionBreakdownTable } from "@/components/clients/CommissionBreakdownTable";
import { InvestmentsSection } from "@/components/clients/InvestmentsSection";
import { Button } from "@/components/ui/button";
import { Avatar, BrandBadge } from "@/components/brand";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

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

function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const advisorId = parseInt((resolvedSearchParams?.advisor as string) ?? "1", 10);
  const clientId = parseInt(resolvedParams.clientId, 10);

  const [clientDetail, drafts, wrappers, productIntelligence, commissionCalculation] = await Promise.all([
    getClientDetail(advisorId, clientId),
    getClientCommunicationDrafts(advisorId, clientId),
    getClientWrappers(advisorId, clientId),
    getClientProductIntelligence(advisorId, clientId),
    getClientCommissionCalculation(advisorId, clientId),
  ]);

  if (!clientDetail) {
    notFound();
  }

  // Merge wrapper-aware alerts with policy-level alerts (wrapper alerts take priority)
  const wrapperAlerts = buildWrapperAlerts(wrappers);
  const mergedAlerts = [
    ...wrapperAlerts,
    ...clientDetail.alerts.filter(
      (a) => !wrapperAlerts.some((wa) => wa.label === a.label),
    ),
  ].slice(0, 6);

  const asAt = new Date().toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href={`/clients?advisor=${advisorId}`} className="hover:text-foreground">
              Clients
            </Link>
            <span>/</span>
            <span>{clientDetail.client_name}</span>
          </div>
          <div className="flex items-center gap-3">
            <BrandBadge size="lg" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {clientDetail.client_name}
            </h1>
          </div>
          <p className="text-base sm:text-lg font-semibold text-primary">
            Total AUM: <span className="brand-amount">{formatZarExact(clientDetail.total_aum)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Managed by {clientDetail.advisor_name} · Client since {clientDetail.client_since} · as at {asAt}
          </p>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/clients?advisor=${advisorId}`}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                  Back
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard?advisor=${advisorId}`}>Dashboard</Link>
              </Button>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Last updated {asAt}</span>
              <Info className="h-3.5 w-3.5" />
            </div>
          </div>
          <Avatar initials={clientInitials(clientDetail.client_name)} />
        </div>
      </div>

      <CollapsibleSection
        title="Client Profile"
        description={clientDetail.client_name}
        rightSlot={`${clientDetail.status} · ${clientDetail.risk_profile}`}
      >
        <div className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{clientDetail.email ?? "No email on file"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{clientDetail.phone ?? "No phone on file"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>
                {clientDetail.age !== null
                  ? `${clientDetail.age} years old`
                  : "Age unavailable"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Risk profile</p>
              <p className="font-semibold text-foreground capitalize">
                {clientDetail.risk_profile}
              </p>
            </div>
            <div className="rounded-xl bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-semibold text-foreground capitalize">
                {clientDetail.status}
              </p>
            </div>
            <div className="rounded-xl bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Client since</p>
              <p className="font-semibold text-foreground">
                {clientDetail.client_since}
              </p>
            </div>
            <div className="rounded-xl bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Last activity</p>
              <p className="font-semibold text-foreground">
                {clientDetail.last_activity ?? "No recent activity"}
              </p>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Portfolio Snapshot"
        description={`${clientDetail.policy_count} ${clientDetail.policy_count === 1 ? "policy" : "policies"}`}
        rightSlot={formatZar(clientDetail.total_aum)}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Total AUM</p>
              <p className="text-lg font-semibold brand-amount">
                {formatZar(clientDetail.total_aum)}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Policies</p>
              <p className="text-lg font-semibold text-primary">
                {clientDetail.policy_count}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Weighted 1Y return</p>
              <p className="text-lg font-semibold brand-amount">
                {clientDetail.avg_1y_return_pct.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Average quartile</p>
              <p className="text-lg font-semibold text-primary">
                {clientDetail.avg_quartile.toFixed(1)}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Potential annual commission</p>
              <p className="text-lg font-semibold brand-amount">
                {formatZar(commissionCalculation?.totals.total_potential_annual_commission ?? 0)}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Monthly equivalent</p>
              <p className="text-lg font-semibold brand-amount">
                {formatZar(commissionCalculation?.totals.monthly_commission_equivalent ?? 0)}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <PieChart className="h-4 w-4 text-primary" />
              Largest holdings
            </div>
            <div className="mt-3 space-y-3">
              {clientDetail.policies.slice(0, 3).map((policy) => (
                <div key={policy.policy_id} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">
                      {policy.fund_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {policy.allocation_pct.toFixed(1)}%
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(policy.allocation_pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Alerts & Talking Points"
        rightSlot={`${mergedAlerts.length} alert${mergedAlerts.length === 1 ? "" : "s"}`}
      >
        <div className="space-y-4">
          <div className="space-y-3">
            {mergedAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No urgent client alerts were detected.
              </p>
            ) : (
              mergedAlerts.map((alert) => (
                <div
                  key={`${alert.label}-${alert.detail}`}
                  className="rounded-xl border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">
                      {alert.label}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        alert.severity === "high"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                          : alert.severity === "medium"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {alert.detail}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="rounded-xl border border-border p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">
              Advisor prep notes
            </p>
            {clientDetail.talking_points.map((point) => (
              <div key={point.title} className="space-y-1">
                <p className="text-sm font-medium text-foreground">{point.title}</p>
                <p className="text-sm text-muted-foreground">{point.detail}</p>
              </div>
            ))}
          </div>
          {productIntelligence.primary_signal && (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Product intelligence</p>
              <p className="text-sm text-muted-foreground">
                {productIntelligence.primary_signal.summary}
              </p>
              <div className="rounded-lg bg-muted/20 p-3 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {productIntelligence.primary_signal.provider_name} {productIntelligence.primary_signal.product_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {productIntelligence.primary_signal.headline_eac_pct != null
                    ? `Estimated annual cost ${(productIntelligence.primary_signal.headline_eac_pct * 100).toFixed(2)}%`
                    : "Estimated annual cost not fully disclosed"}
                  {` · confidence ${productIntelligence.primary_signal.confidence_level}`}
                </p>
                {productIntelligence.primary_signal.fit_issue && (
                  <p className="text-xs text-muted-foreground">
                    {productIntelligence.primary_signal.fit_issue}
                  </p>
                )}
                {productIntelligence.primary_signal.cost_issue && (
                  <p className="text-xs text-muted-foreground">
                    {productIntelligence.primary_signal.cost_issue}
                  </p>
                )}
              </div>
              {productIntelligence.primary_signal.alternative_products.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Comparable alternatives
                  </p>
                  {productIntelligence.primary_signal.alternative_products.map((alternative) => (
                    <div key={alternative.product_id} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-medium text-foreground">
                        {alternative.provider_name} {alternative.product_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {alternative.headline_eac_pct != null
                          ? `Estimated annual cost ${(alternative.headline_eac_pct * 100).toFixed(2)}%`
                          : "Estimated annual cost partially disclosed"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{alternative.rationale}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Commission Breakdown"
        description="Estimated potential annual and monthly commissions from the current policy book."
        rightSlot={
          commissionCalculation
            ? formatZar(commissionCalculation.totals.total_potential_annual_commission) +
              " potential"
            : undefined
        }
      >
        <CommissionBreakdownTable calculation={commissionCalculation} />
      </CollapsibleSection>

      <InvestmentsSection wrappers={wrappers} />

      <CollapsibleSection
        title="Recent Client Activity"
        description="The most recent transactions across the client's policies."
        rightSlot={`${clientDetail.recent_transactions.length} transaction${clientDetail.recent_transactions.length === 1 ? "" : "s"}`}
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Date", "Type", "Amount", "Policy", "Fund"].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientDetail.recent_transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-muted-foreground">
                    No transactions are recorded for this client.
                  </td>
                </tr>
              ) : (
                clientDetail.recent_transactions.map((transaction) => (
                  <tr
                    key={transaction.transaction_id}
                    className="border-t border-border"
                  >
                    <td className="px-4 py-3 text-foreground">
                      {transaction.transaction_date}
                    </td>
                    <td className="px-4 py-3 capitalize text-foreground">
                      {transaction.transaction_type.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-3 brand-amount font-medium">
                      {formatZar(transaction.amount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {transaction.policy_number}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {transaction.fund_name}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Client Communications"
        description="Draft emails and talking points for this client."
        rightSlot={`${drafts.length} draft${drafts.length === 1 ? "" : "s"}`}
      >
        <CommunicationWorkspace
          advisorId={advisorId}
          clientId={clientId}
          clientName={clientDetail.client_name}
          drafts={drafts}
        />
      </CollapsibleSection>
    </div>
  );
}
