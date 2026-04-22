"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TopHoldingRow } from "@/lib/portfolio-deepdive";
import { CHART_COLORS, CHART_TOOLTIP_STYLE, ChartCard, formatZar } from "./ChartCard";

interface TopHoldingsBarProps {
  rows: TopHoldingRow[];
}

export function TopHoldingsBar({ rows }: TopHoldingsBarProps) {
  if (rows.length === 0) {
    return (
      <ChartCard
        title="Top Holdings Concentration"
        caption="Largest funds by aggregated AUM."
      >
        <p className="py-12 text-center text-sm text-muted-foreground">
          No holdings to show.
        </p>
      </ChartCard>
    );
  }

  const data = rows.map((row) => ({
    fund_name: row.fund_name,
    value: row.value,
    pct: row.pct,
  }));

  return (
    <ChartCard
      title="Top Holdings Concentration"
      caption="Top 10 funds ranked by AUM. Identifies single-fund concentration risk."
    >
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 30, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(value) => formatZar(Number(value))}
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
          />
          <YAxis
            type="category"
            dataKey="fund_name"
            width={160}
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            tickFormatter={(value: string) =>
              value.length > 22 ? `${value.slice(0, 21)}…` : value
            }
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value: number, _name, entry) => {
              const pct =
                (entry?.payload as { pct?: number } | undefined)?.pct ?? 0;
              return [`${formatZar(value)} (${pct.toFixed(1)}%)`, "AUM"];
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((_, index) => (
              <Cell
                key={index}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
