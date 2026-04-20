"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { ClientWrapper } from "@/lib/advisor-data";
import { BrandBadge } from "@/components/brand";
import { cn } from "@/lib/utils";

const ZAR_PER_USD = 18.5;

const WRAPPER_LABELS: Record<string, string> = {
  retirement_annuity: "Retirement Annuity",
  tfsa: "Tax-Free Savings",
  endowment: "Endowment",
  living_annuity: "Living Annuity",
  preservation_fund: "Preservation Fund",
  unit_trust: "Unit Trust",
  guaranteed_annuity: "Guaranteed Annuity",
  global_endowment: "Global Endowment",
  offshore: "Offshore Investment",
};

const CATEGORIES: {
  key: string;
  label: string;
  wrapperTypes: string[] | null;
}[] = [
  { key: "all", label: "All investments", wrapperTypes: null },
  {
    key: "retirement",
    label: "Retirement",
    wrapperTypes: ["retirement_annuity", "preservation_fund", "living_annuity"],
  },
  {
    key: "endowment",
    label: "Endowments",
    wrapperTypes: ["endowment", "guaranteed_annuity", "global_endowment"],
  },
  {
    key: "flexible",
    label: "Flexible Investments",
    wrapperTypes: ["tfsa", "unit_trust"],
  },
  {
    key: "offshore",
    label: "Offshore/Global Investments",
    wrapperTypes: ["offshore", "global_endowment"],
  },
];

function wrapperLabel(wrapper: ClientWrapper): string {
  return WRAPPER_LABELS[wrapper.wrapper_type] ?? wrapper.wrapper_type;
}

function formatZarExact(value: number): string {
  return `R ${value.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatUsdExact(value: number): string {
  return `$ ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function contributionsToDate(wrapper: ClientWrapper): number {
  if (!wrapper.monthly_contribution || wrapper.monthly_contribution <= 0) {
    return wrapper.total_current_value * 0.7;
  }
  const start = new Date(wrapper.inception_date).getTime();
  if (Number.isNaN(start)) return wrapper.total_current_value * 0.7;
  const months = Math.max(
    0,
    (Date.now() - start) / (1000 * 60 * 60 * 24 * 30.44),
  );
  return Math.min(
    wrapper.monthly_contribution * months,
    wrapper.total_current_value,
  );
}

function benefitsInline(wrapper: ClientWrapper): number {
  return Math.max(0, wrapper.total_current_value - contributionsToDate(wrapper));
}

interface Props {
  wrappers: ClientWrapper[];
}

export function InvestmentsSection({ wrappers }: Props) {
  const [active, setActive] = useState<string>("all");
  const [sectionOpen, setSectionOpen] = useState(true);

  const categoryCounts = CATEGORIES.map((cat) => ({
    ...cat,
    count:
      cat.wrapperTypes === null
        ? wrappers.length
        : wrappers.filter((w) => cat.wrapperTypes!.includes(w.wrapper_type))
            .length,
  }));

  const filtered =
    active === "all"
      ? wrappers
      : wrappers.filter((w) => {
          const cat = CATEGORIES.find((c) => c.key === active);
          return cat?.wrapperTypes?.includes(w.wrapper_type) ?? false;
        });

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <BrandBadge size="sm" />
        <h2 className="text-lg font-semibold text-primary">Your Investments</h2>
        <button
          type="button"
          onClick={() => setSectionOpen((v) => !v)}
          className="ml-auto rounded-full p-1.5 hover:bg-muted transition-colors"
          aria-label={sectionOpen ? "Collapse section" : "Expand section"}
        >
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              !sectionOpen && "-rotate-90",
            )}
          />
        </button>
      </div>

      {sectionOpen && (
        <>
          <div className="px-5 pb-3 flex flex-wrap items-center gap-y-2">
            {categoryCounts.map((cat, idx) => {
              const isActive = active === cat.key;
              return (
                <div key={cat.key} className="flex items-center">
                  {idx > 0 && (
                    <span
                      aria-hidden
                      className="mx-3 h-4 w-px bg-border"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setActive(cat.key)}
                    className={cn(
                      "relative py-1 text-sm font-medium transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {cat.label} ({cat.count})
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute -bottom-[5px] left-0 right-0 h-0.5 rounded-full bg-[hsl(var(--brand-teal))]"
                      />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border">
            {filtered.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No investments in this category.
              </p>
            ) : (
              filtered.map((wrapper) => (
                <InvestmentRow key={wrapper.wrapper_id} wrapper={wrapper} />
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}

function InvestmentRow({ wrapper }: { wrapper: ClientWrapper }) {
  const [open, setOpen] = useState(false);
  const label = wrapperLabel(wrapper);
  const zar = wrapper.total_current_value;
  const usd = zar / ZAR_PER_USD;
  const contribs = contributionsToDate(wrapper);
  const benefits = benefitsInline(wrapper);
  const isDrawdown = wrapper.phase === "drawdown";

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left px-5 py-4 hover:bg-muted/30 transition-colors flex items-start gap-4"
      >
        <BrandBadge size="sm" className="mt-1" />
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-primary">{label}</p>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              {wrapper.wrapper_number} ·{" "}
              {isDrawdown ? "Drawdown" : "Accumulation"}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCell
              label="Investment value in USD"
              value={formatUsdExact(usd)}
            />
            <MetricCell
              label="Investment value in ZAR"
              value={formatZarExact(zar)}
            />
            <MetricCell
              label="Contributions to date"
              value={formatZarExact(contribs)}
            />
            <MetricCell
              label="Benefits inline to receive:"
              value={formatZarExact(benefits)}
              accent
            />
          </div>
        </div>
        <ChevronRight
          className={cn(
            "h-5 w-5 mt-2 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 sm:pl-[72px] space-y-3">
          {wrapper.wrapper_type === "living_annuity" &&
            wrapper.drawdown_rate_pct !== null && (
              <LaSustainabilityBadge drawdownRate={wrapper.drawdown_rate_pct} />
            )}

          {!wrapper.beneficiary_nominated && (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              No beneficiary nominated — action required.
            </div>
          )}

          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Since <span className="text-foreground">{wrapper.inception_date}</span>
            </span>
            {wrapper.monthly_contribution !== null &&
              wrapper.monthly_contribution > 0 && (
                <span>
                  Monthly contribution{" "}
                  <span className="text-foreground">
                    {formatZarExact(wrapper.monthly_contribution)}
                  </span>
                </span>
              )}
            {isDrawdown && wrapper.monthly_income !== null && (
              <span>
                Monthly income{" "}
                <span className="text-foreground">
                  {formatZarExact(wrapper.monthly_income)}
                </span>
              </span>
            )}
          </div>

          {wrapper.holdings.length > 0 ? (
            <HoldingsTable holdings={wrapper.holdings} />
          ) : (
            <p className="text-xs text-muted-foreground">
              No fund holdings recorded for this wrapper.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold mt-0.5 truncate",
          accent ? "brand-amount" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function LaSustainabilityBadge({ drawdownRate }: { drawdownRate: number }) {
  const pct = (drawdownRate * 100).toFixed(1);
  if (drawdownRate <= 0.05) {
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
  if (drawdownRate <= 0.075) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            Moderate depletion risk · {pct}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor closely — approaching the sustainable ceiling.
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
          Drawdown rate significantly exceeds sustainable levels.
        </p>
      </div>
    </div>
  );
}

function HoldingsTable({
  holdings,
}: {
  holdings: ClientWrapper["holdings"];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-xs">
        <thead className="bg-muted/40">
          <tr>
            {["Fund", "Sector", "Allocation", "Value", "1Y Return", "Quartile"].map(
              (h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => {
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
              <tr
                key={holding.holding_id}
                className="border-t border-border/50"
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  <div>{holding.fund_name}</div>
                  {holding.fund_ticker && (
                    <div className="text-muted-foreground">
                      {holding.fund_ticker}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {holding.peer_group_name ?? holding.sector_name ?? "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(holding.allocation_pct, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-foreground">
                      {holding.allocation_pct.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 brand-amount font-medium whitespace-nowrap">
                  {formatZarExact(holding.current_value)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 font-medium whitespace-nowrap",
                    returnColor,
                  )}
                >
                  {holding.one_year_return_pct.toFixed(1)}%
                </td>
                <td
                  className={cn(
                    "px-3 py-2 font-medium whitespace-nowrap",
                    quartileColor,
                  )}
                >
                  Q{holding.quartile}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
