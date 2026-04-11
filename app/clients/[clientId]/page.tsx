import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Mail,
  Phone,
  PieChart,
  Wallet,
} from "lucide-react";
import {
  buildWrapperAlerts,
  getClientCommunicationDrafts,
  getClientDetail,
  getClientWrappers,
} from "@/lib/advisor-data";
import { CommunicationWorkspace } from "@/components/clients/CommunicationWorkspace";
import { WrapperHoldings } from "@/components/clients/WrapperHoldings";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${value.toLocaleString()}`;
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

  const [clientDetail, drafts, wrappers] = await Promise.all([
    getClientDetail(advisorId, clientId),
    getClientCommunicationDrafts(advisorId, clientId),
    getClientWrappers(advisorId, clientId),
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href={`/clients?advisor=${advisorId}`} className="hover:text-foreground">
              Clients
            </Link>
            <span>/</span>
            <span>{clientDetail.client_name}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {clientDetail.client_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Managed by {clientDetail.advisor_name}. Client since {clientDetail.client_since}.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={`/clients?advisor=${advisorId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to clients
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dashboard?advisor=${advisorId}`}>Dashboard</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Client Profile
            </h2>
            <p className="text-lg font-semibold text-foreground">
              {clientDetail.client_name}
            </p>
          </div>
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

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Wallet className="h-4 w-4 text-primary" />
            Portfolio Snapshot
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Total AUM</p>
              <p className="text-lg font-semibold text-foreground">
                {formatZar(clientDetail.total_aum)}
              </p>
            </div>
            <div className="rounded-xl bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Policies</p>
              <p className="text-lg font-semibold text-foreground">
                {clientDetail.policy_count}
              </p>
            </div>
            <div className="rounded-xl bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Weighted 1Y return</p>
              <p className="text-lg font-semibold text-foreground">
                {clientDetail.avg_1y_return_pct.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Average quartile</p>
              <p className="text-lg font-semibold text-foreground">
                {clientDetail.avg_quartile.toFixed(1)}
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

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Alerts and talking points
          </div>

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
        </div>
      </div>

      {/* Investment Wrappers — full width, grouped by wrapper type */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Investment Wrappers</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Each wrapper is a separate legal/tax container. Fund holdings are shown per wrapper.
          </p>
        </div>
        <WrapperHoldings wrappers={wrappers} />
      </div>

      {/* Recent transactions — full width below wrappers */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            Recent Client Activity
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            The most recent transactions across the client&apos;s policies.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/30">
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
                    <td className="px-4 py-3 text-foreground">
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
      </div>

      <CommunicationWorkspace
        advisorId={advisorId}
        clientId={clientId}
        clientName={clientDetail.client_name}
        drafts={drafts}
      />
    </div>
  );
}
