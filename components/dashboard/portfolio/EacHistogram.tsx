"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EacHistogramBucket } from "@/lib/portfolio-deepdive";
import { CHART_TOOLTIP_STYLE, ChartCard, formatZar } from "./ChartCard";

interface EacHistogramProps {
  buckets: EacHistogramBucket[];
  weightedAvgNerPct: number;
}

const BUCKET_COLORS = [
  "hsl(142 70% 42%)",
  "hsl(180 60% 45%)",
  "hsl(38 92% 55%)",
  "hsl(25 85% 55%)",
  "hsl(0 72% 55%)",
];

export function EacHistogram({ buckets, weightedAvgNerPct }: EacHistogramProps) {
  const data = buckets.map((bucket) => ({
    bucket_label: bucket.bucket_label,
    value: bucket.value,
    pct: bucket.pct,
  }));

  return (
    <ChartCard
      title="Cost Distribution (Net Expense Ratio)"
      caption="AUM by fund NER band. Weighted average NER across the holdings is marked on the axis."
      rightSlot={
        <div>
          <p className="uppercase tracking-wide text-[10px] text-muted-foreground">
            Weighted NER
          </p>
          <p className="text-sm font-semibold text-foreground">
            {weightedAvgNerPct.toFixed(2)}%
          </p>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="bucket_label"
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            label={{
              value: "Fund NER band",
              position: "insideBottom",
              offset: -6,
              style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
            }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            tickFormatter={(value) => formatZar(Number(value))}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value: number, _name, entry) => {
              const pct =
                (entry?.payload as { pct?: number } | undefined)?.pct ?? 0;
              return [`${formatZar(value)} (${pct.toFixed(1)}%)`, "AUM"];
            }}
          />
          <ReferenceLine
            x={`${weightedAvgNerPct.toFixed(2)}%`}
            stroke="hsl(var(--chart-2))"
            strokeDasharray="3 3"
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell
                key={index}
                fill={BUCKET_COLORS[index % BUCKET_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
