"use client";

import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { RiskReturnPoint } from "@/lib/portfolio-deepdive";
import { CHART_TOOLTIP_STYLE, ChartCard, formatZar } from "./ChartCard";

interface RiskReturnScatterProps {
  points: RiskReturnPoint[];
}

export function RiskReturnScatter({ points }: RiskReturnScatterProps) {
  if (points.length === 0) {
    return (
      <ChartCard
        title="Risk vs Return"
        caption="One point per client — available in the whole-book view."
      >
        <p className="py-12 text-center text-sm text-muted-foreground">
          Select the whole-book view to see this chart.
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Risk vs Return"
      caption="One point per client — bubble size is AUM, red bubbles have a risk-profile mismatch."
    >
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 4, right: 16, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            type="number"
            dataKey="one_year_return_pct"
            name="1Y Return"
            unit="%"
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            label={{
              value: "Weighted 1Y return (%)",
              position: "insideBottom",
              offset: -2,
              style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
            }}
          />
          <YAxis
            type="number"
            dataKey="avg_quartile"
            name="Quartile"
            domain={[0.8, 4.2]}
            reversed
            ticks={[1, 2, 3, 4]}
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            label={{
              value: "Avg quartile (lower = better)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
            }}
          />
          <ZAxis type="number" dataKey="total_aum" range={[30, 400]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={CHART_TOOLTIP_STYLE}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const point = payload[0].payload as RiskReturnPoint;
              return (
                <div
                  style={CHART_TOOLTIP_STYLE}
                  className="px-2.5 py-2 space-y-0.5 text-xs"
                >
                  <p className="font-semibold text-foreground">{point.client_name}</p>
                  <p className="text-muted-foreground">
                    1Y return: {point.one_year_return_pct.toFixed(1)}%
                  </p>
                  <p className="text-muted-foreground">
                    Avg quartile: {point.avg_quartile.toFixed(1)}
                  </p>
                  <p className="text-muted-foreground">AUM: {formatZar(point.total_aum)}</p>
                  {point.has_risk_mismatch && (
                    <p className="text-red-600 dark:text-red-400 font-medium">
                      Risk mismatch
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Scatter name="Clients" data={points}>
            {points.map((point) => (
              <Cell
                key={point.client_id}
                fill={
                  point.has_risk_mismatch
                    ? "hsl(0 72% 55%)"
                    : "hsl(var(--chart-2))"
                }
                fillOpacity={0.7}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
