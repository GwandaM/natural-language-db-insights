import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TodayAction } from "@/lib/insights";
import { Button } from "@/components/ui/button";
import { BrandBadge } from "@/components/brand";

interface TodayActionsProps {
  actions: TodayAction[];
  advisorId: number;
}

export function TodayActions({ actions, advisorId }: TodayActionsProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <BrandBadge size="sm" />
          <div className="space-y-1">
            <div className="text-sm font-semibold text-primary">
              Today&apos;s Actions
            </div>
            <p className="text-sm text-muted-foreground">
              Recommended next steps pulled from the morning briefing.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/clients?advisor=${advisorId}`}>All clients</Link>
        </Button>
      </div>

      <div className="space-y-3">
        {actions.map((action) => (
          <Link
            key={`${action.href}-${action.title}`}
            href={action.href}
            className="block rounded-xl border border-border p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {action.title}
                </p>
                <p className="text-sm text-muted-foreground">{action.detail}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  action.tone === "high"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                    : action.tone === "medium"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                }`}
              >
                {action.tone}
              </span>
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--brand-teal-ink))] dark:text-[hsl(var(--brand-teal))]">
              Open client
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
