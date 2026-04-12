"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { CircleHelp } from "lucide-react";
import { ClientRow } from "@/lib/advisor-data";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SortMode = "aum" | "commission" | "risk";
type PhaseFilter = "all" | "pre" | "post";

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

function DrawdownCell({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-muted-foreground">—</span>;
  const pct = rate * 100;
  const color =
    pct <= 5   ? "text-emerald-600 dark:text-emerald-400" :
    pct <= 7.5 ? "text-amber-600 dark:text-amber-400" :
                 "text-red-600 dark:text-red-400";
  return <span className={`font-medium ${color}`}>{pct.toFixed(1)}%</span>;
}

function YearsToRetireCell({ years }: { years: number | null }) {
  if (years === null) return <span className="text-muted-foreground">—</span>;
  const color =
    years > 10 ? "text-emerald-600 dark:text-emerald-400" :
    years > 3  ? "text-amber-600 dark:text-amber-400" :
                 "text-red-600 dark:text-red-400";
  return <span className={`font-medium ${color}`}>{years}y</span>;
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
  advisorId: number;
  clients: ClientRow[];
  externalSort?: SortMode;
  onSortChange?: (sort: SortMode) => void;
  title?: string;
  subtitle?: string;
}

export function ClientIntelligenceTable({
  advisorId,
  clients,
  externalSort,
  onSortChange,
  title = "Client Intelligence",
  subtitle = `${clients.length} clients — use the sort toggles to prioritise the book`,
}: Props) {
  const [internalSort, setInternalSort] = useState<SortMode>("aum");
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("all");
  const sortMode = externalSort ?? internalSort;
  const commissionRankCopy =
    "When this sort is active, rank is based on estimated total potential annual commission from the client's current policy book.";

  const setSort = (s: SortMode) => {
    setInternalSort(s);
    onSortChange?.(s);
  };

  const filtered = useMemo(() => {
    if (phaseFilter === "pre") return clients.filter((c) => !c.is_post_retirement);
    if (phaseFilter === "post") return clients.filter((c) => c.is_post_retirement);
    return clients;
  }, [clients, phaseFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sortMode === "commission") {
      copy.sort((a, b) => b.potential_annual_commission - a.potential_annual_commission);
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
  }, [filtered, sortMode]);

  const sortButtons: { key: SortMode; label: string }[] = [
    { key: "aum",        label: "By AUM" },
    { key: "commission", label: "Potential Annual Commission" },
    { key: "risk",       label: "Risk Priority" },
  ];

  const phaseButtons: { key: PhaseFilter; label: string }[] = [
    { key: "all",  label: "All" },
    { key: "pre",  label: "Pre-Retirement" },
    { key: "post", label: "Post-Retirement" },
  ];

  const dynamicColHeader =
    phaseFilter === "post" ? "Drawdown Rate" :
    phaseFilter === "pre"  ? "Yrs to Retire" :
                             "Avg Quartile";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">
              {sortMode === "commission"
                ? `${sorted.length} of ${clients.length} clients — ranked by estimated total potential annual commission`
                : subtitle}
              {phaseFilter !== "all"
                ? ` — ${phaseFilter === "pre" ? "pre-retirement" : "post-retirement"} view`
                : ""}
            </p>
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
        {/* Phase filter row */}
        <div className="flex gap-2 flex-wrap">
          {phaseButtons.map((b) => (
            <button
              key={b.key}
              onClick={() => setPhaseFilter(b.key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors border ${
                phaseFilter === b.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {b.label}
              {b.key !== "all" && (
                <span className="ml-1.5 opacity-60">
                  ({b.key === "pre"
                    ? clients.filter((c) => !c.is_post_retirement).length
                    : clients.filter((c) => c.is_post_retirement).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <span>Rank</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex text-muted-foreground hover:text-foreground"
                          aria-label="Explain commission ranking"
                        >
                          <CircleHelp className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        {commissionRankCopy}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Client</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">AUM</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Annual Comm.</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Risk Profile</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">1Y Return</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">{dynamicColHeader}</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Risk Align</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Last Activity</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">⚑</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {sorted.map((c, i) => (
              <tr key={c.client_id} className="hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{c.client_name}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatZar(c.total_aum)}</td>
                <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                  {formatZar(c.potential_annual_commission)}/yr
                </td>
                <td className="px-4 py-3 capitalize">{c.risk_profile}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <ReturnCell value={c.avg_1y_return_pct} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {phaseFilter === "post"
                    ? <DrawdownCell rate={c.la_drawdown_rate_pct} />
                    : phaseFilter === "pre"
                      ? <YearsToRetireCell years={c.years_to_retirement} />
                      : <QuartileCell value={c.avg_quartile} />}
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
                <td className="px-4 py-3 whitespace-nowrap">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/clients/${c.client_id}?advisor=${advisorId}`}>
                      View details
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
