"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Search, Sparkles, X } from "lucide-react";
import { searchClientsAI, ClientSearchResult } from "@/app/cockpit-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${value.toLocaleString()}`;
}

interface ClientAISearchProps {
  advisorId: number;
}

export function ClientAISearch({ advisorId }: ClientAISearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || isPending) return;

    setError(null);
    startTransition(async () => {
      try {
        const { results: found } = await searchClientsAI(advisorId, query);
        setResults(found);
      } catch {
        setError("Search failed — try rephrasing your query.");
        setResults(null);
      }
    });
  }

  function handleClear() {
    setQuery("");
    setResults(null);
    setError(null);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask AI: &quot;clients with aggressive risk over R1M&quot; or &quot;dormant clients with no activity in 6 months&quot;"
            className="pl-9 pr-8"
            disabled={isPending}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" size="sm" disabled={isPending || !query.trim()}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-1.5 hidden sm:inline">Search</span>
        </Button>
      </form>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {results !== null && (
        <div className="rounded-xl border border-border overflow-hidden">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              No clients matched your query.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {["Client", "Risk Profile", "Status", "AUM", "Policies", "1Y Return"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((client) => (
                    <tr key={client.client_id} className="border-t border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/clients/${client.client_id}?advisor=${advisorId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {client.client_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 capitalize text-foreground">{client.risk_profile}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            client.status === "active"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : client.status === "dormant"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                          }`}
                        >
                          {client.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium brand-amount tabular-nums">{formatZar(client.total_aum)}</td>
                      <td className="px-4 py-2.5 text-foreground tabular-nums">{client.policy_count}</td>
                      <td className="px-4 py-2.5 tabular-nums text-foreground">{client.avg_1y_return_pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-2 bg-muted/20 border-t border-border">
            <p className="text-[11px] text-muted-foreground">
              {results.length} result{results.length === 1 ? "" : "s"} · Powered by AI
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
