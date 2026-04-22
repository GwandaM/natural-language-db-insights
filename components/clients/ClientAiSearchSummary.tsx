"use client";

import { Sparkles } from "lucide-react";
import { ClientSearchResult } from "@/app/client-search-actions";

interface ClientAiSearchSummaryProps {
  result: ClientSearchResult;
}

export function ClientAiSearchSummary({ result }: ClientAiSearchSummaryProps) {
  const { interpreted_query, summary, matches } = result;
  const hasMatches = matches.length > 0;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        AI search
      </div>
      {interpreted_query && (
        <p className="text-sm text-foreground">
          <span className="text-muted-foreground">Interpreted as:</span>{" "}
          {interpreted_query}
        </p>
      )}
      {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
      {!hasMatches && (
        <p className="text-sm text-muted-foreground">
          No clients in this book matched that query.
        </p>
      )}
      {hasMatches && matches.length <= 5 && (
        <ul className="space-y-1.5 pt-1">
          {matches.map((match) => (
            <li key={match.client_id} className="text-sm">
              <span className="font-medium text-foreground">{match.client_name}</span>
              <span className="text-muted-foreground"> — {match.reason}</span>
            </li>
          ))}
        </ul>
      )}
      {hasMatches && matches.length > 5 && (
        <p className="text-xs text-muted-foreground">
          Showing {matches.length} matches below, ranked by relevance.
        </p>
      )}
    </div>
  );
}
