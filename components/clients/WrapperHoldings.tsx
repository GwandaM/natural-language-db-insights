import { AlertTriangle, CheckCircle, Info, TrendingUp } from "lucide-react";
import { ClientWrapper } from "@/lib/advisor-data";
import { BrandBadge } from "@/components/brand";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${value.toLocaleString()}`;
}

const WRAPPER_LABELS: Record<string, string> = {
  retirement_annuity: "Retirement Annuity",
  tfsa: "Tax-Free Savings",
  endowment: "Endowment",
  living_annuity: "Living Annuity",
  preservation_fund: "Preservation Fund",
  unit_trust: "Unit Trust",
  guaranteed_annuity: "Guaranteed Annuity",
};

const WRAPPER_ABBR: Record<string, string> = {
  retirement_annuity: "RA",
  tfsa: "TFSA",
  endowment: "END",
  living_annuity: "LA",
  preservation_fund: "PF",
  unit_trust: "UT",
  guaranteed_annuity: "GA",
};

// Estimate years to capital depletion for a living annuity.
// Assumes nominal 6% annual portfolio return.
function laYearsToDepletion(drawdownRate: number): number | null {
  const r = 0.06;
  const d = drawdownRate;
  if (d <= r) return null; // indefinitely sustainable
  // PV annuity formula inverted: years = -ln(1 - r/d) / ln(1+r)
  return Math.round(-Math.log(1 - r / d) / Math.log(1 + r));
}

type LaSustainability = "safe" | "caution" | "critical";

function laSustainability(drawdownRate: number): LaSustainability {
  if (drawdownRate <= 0.05) return "safe";
  if (drawdownRate <= 0.075) return "caution";
  return "critical";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LASustainabilityBadge({ drawdownRate }: { drawdownRate: number }) {
  const level = laSustainability(drawdownRate);
  const pct = (drawdownRate * 100).toFixed(1);
  const years = laYearsToDepletion(drawdownRate);

  if (level === "safe") {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
        <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Sustainable drawdown · {pct}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Current income rate is within sustainable range (≤ 5%).
          </p>
        </div>
      </div>
    );
  }

  if (level === "caution") {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            Moderate depletion risk · {pct}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {years !== null
              ? `Capital may be exhausted in ~${years} years at current returns.`
              : "Monitor closely — approaching the sustainable ceiling."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold text-red-700 dark:text-red-400">
          High depletion risk · {pct}%
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {years !== null
            ? `At 6% assumed returns, capital exhaustion in ~${years} years. Immediate review recommended.`
            : "Drawdown rate significantly exceeds sustainable levels."}
        </p>
      </div>
    </div>
  );
}

function WrapperCard({ wrapper }: { wrapper: ClientWrapper }) {
  const label = WRAPPER_LABELS[wrapper.wrapper_type] ?? wrapper.wrapper_type;
  const abbr = WRAPPER_ABBR[wrapper.wrapper_type] ?? "?";
  const isLA = wrapper.wrapper_type === "living_annuity";
  const isDrawdown = wrapper.phase === "drawdown";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Card header */}
      <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 border-b border-border">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <BrandBadge size="sm" />
          <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 shrink-0">
            {abbr}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{label}</p>
            <p className="text-[10px] text-muted-foreground">
              {wrapper.wrapper_number} · {isDrawdown ? "Drawdown" : "Accumulation"} · since{" "}
              {wrapper.inception_date}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:text-right shrink-0">
          <div>
            <p className="text-xs text-muted-foreground">Total value</p>
            <p className="text-base font-semibold brand-amount">
              {formatZar(wrapper.total_current_value)}
            </p>
          </div>
          {isDrawdown && wrapper.monthly_income !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Monthly income</p>
              <p className="text-base font-semibold brand-amount">
                {formatZar(wrapper.monthly_income)}
              </p>
            </div>
          )}
          {!isDrawdown && wrapper.monthly_contribution !== null && wrapper.monthly_contribution > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Monthly contrib.</p>
              <p className="text-base font-semibold brand-amount">
                {formatZar(wrapper.monthly_contribution)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* LA sustainability block */}
        {isLA && wrapper.drawdown_rate_pct !== null && (
          <LASustainabilityBadge drawdownRate={wrapper.drawdown_rate_pct} />
        )}

        {/* Beneficiary flag */}
        {!wrapper.beneficiary_nominated && (
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            No beneficiary nominated — action required.
          </div>
        )}

        {/* Fund holdings table */}
        {wrapper.holdings.length > 0 ? (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Fund", "Sector", "Allocation", "Value", "1Y Return", "Quartile"].map((h) => (
                    <th
                      key={h}
                      className="pb-2 pr-4 text-left font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {wrapper.holdings.map((holding) => {
                  const returnColor =
                    holding.one_year_return_pct >= 10
                      ? "text-emerald-600 dark:text-emerald-400"
                      : holding.one_year_return_pct >= 5
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400";

                  const quartileColor =
                    holding.quartile === 1
                      ? "text-emerald-600 dark:text-emerald-400"
                      : holding.quartile === 2
                        ? "text-blue-600 dark:text-blue-400"
                        : holding.quartile === 3
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400";

                  return (
                    <tr key={holding.holding_id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 font-medium text-foreground">
                        <div>{holding.fund_name}</div>
                        {holding.fund_ticker && (
                          <div className="text-muted-foreground">{holding.fund_ticker}</div>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                        {holding.peer_group_name ?? holding.sector_name ?? "—"}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(holding.allocation_pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-foreground">{holding.allocation_pct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-foreground whitespace-nowrap">
                        {formatZar(holding.current_value)}
                      </td>
                      <td className={`py-2 pr-4 font-medium whitespace-nowrap ${returnColor}`}>
                        {holding.one_year_return_pct.toFixed(1)}%
                      </td>
                      <td className={`py-2 font-medium whitespace-nowrap ${quartileColor}`}>
                        Q{holding.quartile}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No fund holdings recorded for this wrapper.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface Props {
  wrappers: ClientWrapper[];
}

export function WrapperHoldings({ wrappers }: Props) {
  if (wrappers.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">No investment wrappers on record</p>
        <p className="text-xs text-muted-foreground mt-1">
          Wrapper data will appear here once holdings are captured.
        </p>
      </div>
    );
  }

  const totalAum = wrappers.reduce((s, w) => s + w.total_current_value, 0);

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex flex-wrap gap-6 px-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Total across wrappers
          </p>
          <p className="text-lg font-semibold brand-amount">{formatZar(totalAum)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Wrappers
          </p>
          <p className="text-lg font-semibold text-primary">{wrappers.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Fund holdings
          </p>
          <p className="text-lg font-semibold text-primary">
            {wrappers.reduce((s, w) => s + w.holdings.length, 0)}
          </p>
        </div>
      </div>

      {wrappers.map((wrapper) => (
        <WrapperCard key={wrapper.wrapper_id} wrapper={wrapper} />
      ))}
    </div>
  );
}
