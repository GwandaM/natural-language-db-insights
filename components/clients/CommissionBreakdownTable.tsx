import { CommissionCalculationResult } from "@/lib/commission";

interface Props {
  calculation: CommissionCalculationResult | null;
}

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${value.toLocaleString()}`;
}

export function CommissionBreakdownTable({ calculation }: Props) {
  if (!calculation) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Commission Breakdown</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No commission-bearing policy data is available for this client yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border space-y-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Commission Breakdown</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Estimated from the current policy book using the commission engine&apos;s annual rate card.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Potential annual commission</p>
            <p className="text-lg font-semibold text-foreground">
              {formatZar(calculation.totals.total_potential_annual_commission)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Monthly equivalent</p>
            <p className="text-lg font-semibold text-foreground">
              {formatZar(calculation.totals.monthly_commission_equivalent)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Policies included</p>
            <p className="text-lg font-semibold text-foreground">
              {calculation.totals.entries_count}
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          {calculation.assumptions.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              {["Policy", "Type", "Status", "Current Value", "Annual Rate", "Annual Commission", "Basis"].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calculation.breakdown.map((row) => (
              <tr key={row.entry_id} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                  {row.source_label}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {row.product_type_label}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap capitalize">
                  {row.status ?? "unknown"}
                </td>
                <td className="px-4 py-3 text-foreground whitespace-nowrap">
                  {formatZar(row.current_value)}
                </td>
                <td className="px-4 py-3 text-foreground whitespace-nowrap">
                  {(row.annual_rate * 100).toFixed(2)}%
                </td>
                <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                  {formatZar(row.estimated_annual_commission)}
                </td>
                <td className="px-4 py-3 text-muted-foreground min-w-[240px]">
                  {row.rationale}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/20 border-t border-border">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-foreground">
                Total
              </td>
              <td className="px-4 py-3 text-sm font-semibold text-foreground whitespace-nowrap">
                {formatZar(calculation.totals.total_current_value)}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">—</td>
              <td className="px-4 py-3 text-sm font-semibold text-foreground whitespace-nowrap">
                {formatZar(calculation.totals.total_potential_annual_commission)}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                Rule version {calculation.rule_version}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
