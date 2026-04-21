import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { PriorityClientInsight } from "@/lib/insights";

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${value.toLocaleString()}`;
}

interface PriorityClientsCardProps {
  clients: PriorityClientInsight[];
  advisorId: number;
  viewAllHref?: string;
}

export function PriorityClientsCard({
  clients,
  advisorId,
  viewAllHref = "/priorities",
}: PriorityClientsCardProps) {
  const topFive = clients.slice(0, 5);

  return (
    <section className="premium-card flex h-full flex-col overflow-hidden">
      <header className="px-5 pt-5 pb-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Priority Clients
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Top 5 relationships ranked by signal strength.
        </p>
      </header>

      {topFive.length === 0 ? (
        <div className="px-5 pb-5 text-sm text-muted-foreground">
          No priority clients flagged for this advisor.
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-border">
          {topFive.map((client) => (
            <li key={client.client_id}>
              <Link
                href={`/clients/${client.client_id}?advisor=${advisorId}`}
                className="group/row flex items-start justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {client.client_name}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {client.headline}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="brand-amount text-sm font-semibold">
                    {formatZar(client.total_aum)}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[hsl(var(--brand-teal-ink))] dark:text-[hsl(var(--brand-teal))]">
                    View
                    <ArrowUpRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="border-t border-border px-5 py-3">
        <Link
          href={viewAllHref}
          className="group/link inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--brand-teal-ink))] hover:underline underline-offset-2 dark:text-[hsl(var(--brand-teal))]"
        >
          View all
          <ChevronRight className="h-4 w-4 transition-transform duration-150 group-hover/link:translate-x-0.5" />
        </Link>
      </footer>
    </section>
  );
}
