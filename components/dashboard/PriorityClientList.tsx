import Link from "next/link";
import { ArrowRight, UserRound } from "lucide-react";
import { PriorityClientInsight } from "@/lib/insights";

interface PriorityClientListProps {
  advisorId: number;
  clients: PriorityClientInsight[];
}

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${value.toLocaleString()}`;
}

export function PriorityClientList({
  advisorId,
  clients,
}: PriorityClientListProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <UserRound className="h-4 w-4 text-primary" />
          Suggested Clients
        </div>
        <p className="text-sm text-muted-foreground">
          Start here if you want to work the highest-priority relationships first.
        </p>
      </div>

      <div className="space-y-3">
        {clients.map((client) => (
          <Link
            key={client.client_id}
            href={`/clients/${client.client_id}?advisor=${advisorId}`}
            className="block rounded-xl border border-border p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {client.client_name}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      client.status === "active"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {client.status}
                  </span>
                </div>
                <p className="text-sm text-foreground">{client.headline}</p>
                <p className="text-sm text-muted-foreground">{client.rationale}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">AUM</p>
                <p className="text-sm font-semibold text-foreground">
                  {formatZar(client.total_aum)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {client.suggested_action}
              </p>
              <span className="inline-flex items-center gap-1 text-sm text-primary shrink-0">
                View details
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
