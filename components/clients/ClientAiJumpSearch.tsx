"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { ClientAiSearchBar } from "@/components/clients/ClientAiSearchBar";
import { ClientSearchResult } from "@/app/client-search-actions";

interface ClientAiJumpSearchProps {
  advisorId: number;
  currentClientId: number;
}

export function ClientAiJumpSearch({
  advisorId,
  currentClientId,
}: ClientAiJumpSearchProps) {
  const [result, setResult] = useState<ClientSearchResult | null>(null);

  const otherMatches = result
    ? result.matches.filter((match) => match.client_id !== currentClientId)
    : [];
  const sameClientMatched =
    !!result && result.matches.some((match) => match.client_id === currentClientId);

  return (
    <div className="space-y-4">
      <ClientAiSearchBar
        advisorId={advisorId}
        placeholder="e.g. Other conservative clients with risk mismatches"
        helperText="Jump to another client in your book using natural language."
        onResult={setResult}
      />

      {result && (
        <div className="rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            AI search results
          </div>

          {result.interpreted_query && (
            <p className="text-sm text-foreground">
              <span className="text-muted-foreground">Interpreted as:</span>{" "}
              {result.interpreted_query}
            </p>
          )}
          {result.summary && (
            <p className="text-sm text-muted-foreground">{result.summary}</p>
          )}

          {sameClientMatched && (
            <p className="text-xs text-muted-foreground">
              This client also matches your query.
            </p>
          )}

          {otherMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No other clients in your book matched that query.
            </p>
          ) : (
            <ul className="space-y-2">
              {otherMatches.map((match) => (
                <li key={match.client_id}>
                  <Link
                    href={`/clients/${match.client_id}?advisor=${advisorId}`}
                    className="group flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 hover:border-primary/50 hover:bg-primary/[0.03] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {match.client_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{match.reason}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
