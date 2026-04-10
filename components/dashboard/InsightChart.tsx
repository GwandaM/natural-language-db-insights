"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface InsightChartProps {
  title: string;
  caption: string;
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  type?: "bar" | "line";
  yLabel?: string;
  xTickFormatter?: (v: string | number) => string;
  yTickFormatter?: (v: string | number) => string;
}

export function InsightChart({
  title,
  caption,
  data,
  xKey,
  yKey,
  type = "bar",
  xTickFormatter,
  yTickFormatter,
}: InsightChartProps) {
  const chartData = data.slice(0, 20);

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{caption}</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        {type === "line" ? (
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              tickFormatter={xTickFormatter}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              tickFormatter={yTickFormatter}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: 12,
              }}
              formatter={yTickFormatter ? (v: number) => [yTickFormatter(v), yKey] : undefined}
            />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        ) : (
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              tickFormatter={xTickFormatter}
              interval={0}
              angle={chartData.length > 6 ? -30 : 0}
              textAnchor={chartData.length > 6 ? "end" : "middle"}
              height={chartData.length > 6 ? 55 : 30}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              tickFormatter={yTickFormatter}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: 12,
              }}
              formatter={yTickFormatter ? (v: number) => [yTickFormatter(v), yKey] : undefined}
            />
            <Bar
              dataKey={yKey}
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
