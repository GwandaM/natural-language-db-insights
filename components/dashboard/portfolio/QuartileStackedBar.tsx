"use client";

import { QuartileBucket } from "@/lib/portfolio-deepdive";
import { ChartCard, formatZar } from "./ChartCard";

interface QuartileStackedBarProps {
  buckets: QuartileBucket[];
}

const QUARTILE_COLORS: Record<1 | 2 | 3 | 4, string> = {
  1: "hsl(142 70% 42%)",
  2: "hsl(200 95% 42%)",
  3: "hsl(38 92% 55%)",
  4: "hsl(0 72% 55%)",
};

const QUARTILE_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Q1 — top",
  2: "Q2",
  3: "Q3",
  4: "Q4 — bottom",
};

export function QuartileStackedBar({ buckets }: QuartileStackedBarProps) {
  const ordered = [1, 2, 3, 4].map(
    (q) =>
      buckets.find((b) => b.quartile === q) ?? {
        quartile: q as 1 | 2 | 3 | 4,
        value: 0,
        pct: 0,
      },
  );
  const total = ordered.reduce((sum, b) => sum + b.value, 0);

  return (
    <ChartCard
      title="Quartile Distribution"
      caption="Share of AUM in Q1 (best-performing) through Q4 (worst) peer-group funds."
      rightSlot={
        <div>
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground">Total</p>
          <p className="text-sm font-semibold brand-amount">{formatZar(total)}</p>
        </div>
      }
    >
      {total === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No quartile data available.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex h-6 w-full rounded-md overflow-hidden">
            {ordered.map((bucket) => (
              <div
                key={bucket.quartile}
                title={`${QUARTILE_LABELS[bucket.quartile]} — ${bucket.pct.toFixed(1)}%`}
                style={{
                  width: `${bucket.pct}%`,
                  backgroundColor: QUARTILE_COLORS[bucket.quartile],
                }}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ordered.map((bucket) => (
              <div
                key={bucket.quartile}
                className="rounded-lg border border-border p-3 space-y-1"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: QUARTILE_COLORS[bucket.quartile] }}
                  />
                  <p className="text-xs font-medium text-foreground">
                    {QUARTILE_LABELS[bucket.quartile]}
                  </p>
                </div>
                <p className="text-sm font-semibold brand-amount">
                  {bucket.pct.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">{formatZar(bucket.value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}
