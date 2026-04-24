"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const DATA = [
  { month: "Jan", thisYear: 42.1, lastYear: 38.5, budget: 43.0 },
  { month: "Feb", thisYear: 43.2, lastYear: 39.1, budget: 43.8 },
  { month: "Mar", thisYear: 44.8, lastYear: 40.2, budget: 44.5 },
  { month: "Apr", thisYear: 46.3, lastYear: 41.5, budget: 45.3 },
  { month: "May", thisYear: null, lastYear: 42.8, budget: 46.0 },
  { month: "Jun", thisYear: null, lastYear: 44.0, budget: 46.8 },
  { month: "Jul", thisYear: null, lastYear: 43.5, budget: 47.5 },
  { month: "Aug", thisYear: null, lastYear: 45.1, budget: 48.3 },
  { month: "Sep", thisYear: null, lastYear: 46.2, budget: 49.0 },
  { month: "Oct", thisYear: null, lastYear: 44.8, budget: 49.8 },
  { month: "Nov", thisYear: null, lastYear: 47.3, budget: 50.5 },
  { month: "Dec", thisYear: null, lastYear: 48.9, budget: 51.3 },
];

export function AumTrackingChart() {
  return (
    <div className="space-y-2 pt-1">
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R${v}M`} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
              formatter={(value: number) => [`R${value}M`, undefined]}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line
              type="monotone"
              dataKey="thisYear"
              name="This Year"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="lastYear"
              name="Last Year"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
            />
            <Line
              type="monotone"
              dataKey="budget"
              name="Budget"
              stroke="#22c55e"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="6 3"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-[10px] text-muted-foreground">
        AUM in R millions · placeholder data
      </p>
    </div>
  );
}
