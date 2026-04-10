"use client";

import { ClientRow } from "@/lib/advisor-data";

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  return `R${value.toLocaleString()}`;
}

interface Props {
  clients: ClientRow[];
  onSortChange: (sort: "aum" | "commission" | "risk") => void;
}

export function AdvisorAlerts({ clients, onSortChange }: Props) {
  const riskMismatches = clients.filter((c) => c.has_risk_mismatch).length;
  const revenueAtRisk = clients
    .filter((c) => c.status !== "active")
    .reduce((sum, c) => sum + c.total_aum, 0);
  const bottomQuartile = clients.filter((c) => c.avg_quartile > 3).length;

  const alerts = [
    {
      icon: "⚠",
      label: "Risk Mismatches",
      value: riskMismatches.toString(),
      sub: "clients with misaligned portfolios",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
      onClick: () => onSortChange("risk"),
    },
    {
      icon: "💰",
      label: "Revenue at Risk",
      value: formatZar(revenueAtRisk),
      sub: "AUM from dormant/inactive clients",
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
      onClick: () => onSortChange("risk"),
    },
    {
      icon: "⬇",
      label: "Bottom Quartile",
      value: bottomQuartile.toString(),
      sub: "clients in Q4 funds — biggest opportunity",
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
      onClick: () => onSortChange("commission"),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {alerts.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          className={`text-left p-4 rounded-lg border ${a.bg} transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{a.icon}</span>
            <span className={`text-xl font-bold ${a.color}`}>{a.value}</span>
          </div>
          <p className="text-sm font-medium text-foreground">{a.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{a.sub}</p>
        </button>
      ))}
    </div>
  );
}
