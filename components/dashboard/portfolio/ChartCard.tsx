import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  caption?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  caption,
  rightSlot,
  children,
  className,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-xl p-5 flex flex-col gap-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">{title}</h3>
          {caption && (
            <p className="text-xs text-muted-foreground mt-1">{caption}</p>
          )}
        </div>
        {rightSlot && (
          <div className="shrink-0 text-xs text-muted-foreground tabular-nums text-right">
            {rightSlot}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${Math.round(value).toLocaleString()}`;
}

export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: 12,
};
