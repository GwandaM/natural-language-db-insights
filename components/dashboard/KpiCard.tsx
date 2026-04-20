import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
}

export function KpiCard({ label, value, sub, icon: Icon }: KpiCardProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          {label}
        </span>
        <span className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold brand-amount">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
