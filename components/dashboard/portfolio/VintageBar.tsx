"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { VintageBucket } from "@/lib/portfolio-deepdive";
import { CHART_TOOLTIP_STYLE, ChartCard, formatZar } from "./ChartCard";

interface VintageBarProps {
  buckets: VintageBucket[];
}

export function VintageBar({ buckets }: VintageBarProps) {
  if (buckets.length === 0) {
    return (
      <ChartCard
        title="Vintage by Fund Inception"
        caption="AUM bucketed by the decade in which each underlying fund was launched."
      >
        <p className="py-12 text-center text-sm text-muted-foreground">
          No vintage data available.
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Vintage by Fund Inception"
      caption="AUM bucketed by the decade in which each underlying fund was launched."
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={buckets} margin={{ top: 4, right: 16, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="decade_label"
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
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
          <Bar
            dataKey="value"
            fill="hsl(var(--chart-4))"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
