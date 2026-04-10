"use client";

import { useState, useMemo } from "react";
import { ClientRow } from "@/lib/advisor-data";

type SortMode = "aum" | "commission" | "risk";

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${value.toLocaleString()}`;
}

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return "No activity";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}yr ago`;
}

function ReturnCell({ value }: { value: number }) {
  const color =
    value >= 10 ? "text-emerald-600 dark:text-emerald-400" :
    value >= 5  ? "text-amber-600 dark:text-amber-400" :
                  "text-red-600 dark:text-red-400";
  return <span className={`font-medium ${color}`}>{value.toFixed(1)}%</span>;
}

function QuartileCell({ value }: { value: number }) {
  const color =
    value <= 1.5 ? "text-emerald-600 dark:text-emerald-400" :
    value <= 2.5 ? "text-blue-600 dark:text-blue-400" :
    value <= 3.5 ? "text-amber-600 dark:text-amber-400" :
                   "text-red-600 dark:text-red-400";
  return <span className={`font-medium ${color}`}>{value.toFixed(1)}★</span>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:   "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    dormant:  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    inactive: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? styles.inactive}`}>
      {status}
    </span>
  );
}

function RiskBadge({ mismatch }: { mismatch: boolean }) {
  return mismatch ? (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
      Mismatch
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
      Aligned
    </span>
  );
}

function ActionFlag({ client }: { client: ClientRow }) {
  const flagged = client.has_risk_mismatch || client.status !== "active" || client.avg_quartile > 3;
  if (!flagged) return <span className="text-muted-foreground/30">—</span>;
  const reasons: string[] = [];
  if (client.has_risk_mismatch) reasons.push("Risk mismatch");
  if (client.status !== "active") reasons.push(`Status: ${client.status}`);
  if (client.avg_quartile > 3) reasons.push("Bottom quartile funds");
  return (
    <span title={reasons.join(", ")} className="cursor-help text-amber-500">⚑</span>
  );
}

interface Props {
  clients: ClientRow[];
  externalSort?: SortMode;
  onSortChange?: (sort: SortMode) => void;
}

export function ClientIntelligenceTable({ clients, externalSort, onSortChange }: Props) {
  const [internalSort, setInternalSort] = useState<SortMode>("aum");
  const sortMode = externalSort ?? internalSort;

  const setSort = (s: SortMode) => {
    setInternalSort(s);
    onSortChange?.(s);
  };

  const sorted = useMemo(() => {
    const copy = [...clients];
    if (sortMode === "commission") {
      copy.sort((a, b) => b.commission_score - a.commission_score);
    } else if (sortMode === "risk") {
      copy.sort((a, b) => {
        const af = (a.has_risk_mismatch ? 0 : 1) + (a.status !== "active" ? 0 : 1);
        const bf = (b.has_risk_mismatch ? 0 : 1) + (b.status !== "active" ? 0 : 1);
        if (af !== bf) return af - bf;
        return b.total_aum - a.total_aum;
      });
    } else {
      copy.sort((a, b) => b.total_aum - a.total_aum);
    }
    return copy;
  }, [clients, sortMode]);

  const sortButtons: { key: SortMode; label: string }[] = [
    { key: "aum",        label: "By AUM" },
    { key: "commission", label: "Commission Opportunity" },
    { key: "risk",       label: "Risk Priority" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Client Intelligence</h2>
          <p className="text-xs text-muted-foreground">{clients.length} clients — click a column to sort</p>
        </div>
        <div className="sm:ml-auto flex gap-2 flex-wrap">
          {sortButtons.map((b) => (
            <button
              key={b.key}
              onClick={() => setSort(b.key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                sortMode === b.key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50">
            <tr>
              {["#", "Client", "AUM", "Risk Profile", "1Y Return", "Avg Quartile", "Risk Align", "Last Activity", "Status", "⚑"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {sorted.map((c, i) => (
              <tr key={c.client_id} className="hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{c.client_name}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatZar(c.total_aum)}</td>
                <td className="px-4 py-3 capitalize">{c.risk_profile}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <ReturnCell value={c.avg_1y_return_pct} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <QuartileCell value={c.avg_quartile} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <RiskBadge mismatch={c.has_risk_mismatch} />
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {relativeDate(c.last_activity)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3 text-center">
                  <ActionFlag client={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
