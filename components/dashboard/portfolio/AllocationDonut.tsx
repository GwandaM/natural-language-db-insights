"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CHART_COLORS, CHART_TOOLTIP_STYLE, ChartCard, formatZar } from "./ChartCard";

interface AllocationSlice {
  label: string;
  value: number;
  pct: number;
}

interface AllocationDonutProps {
  title: string;
  caption: string;
  slices: AllocationSlice[];
  totalLabel?: string;
  totalValue?: number;
}

export function AllocationDonut({
  title,
  caption,
  slices,
  totalLabel,
  totalValue,
}: AllocationDonutProps) {
  const rightSlot =
    totalLabel && totalValue != null ? (
      <div>
        <p className="uppercase tracking-wide text-[10px] text-muted-foreground">
          {totalLabel}
        </p>
        <p className="text-sm font-semibold text-foreground brand-amount">
          {formatZar(totalValue)}
        </p>
      </div>
    ) : undefined;

  if (slices.length === 0) {
    return (
      <ChartCard title={title} caption={caption} rightSlot={rightSlot}>
        <p className="py-12 text-center text-sm text-muted-foreground">
          No data to show.
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title={title} caption={caption} rightSlot={rightSlot}>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={1}
          >
            {slices.map((_, index) => (
              <Cell
                key={index}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
                stroke="hsl(var(--background))"
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value: number, _name, entry) => {
              const pct = (entry?.payload as AllocationSlice | undefined)?.pct ?? 0;
              return [`${formatZar(value)} (${pct.toFixed(1)}%)`, "AUM"];
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
