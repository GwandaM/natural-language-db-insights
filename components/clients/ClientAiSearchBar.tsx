"use client";

import { FormEvent, useState, useTransition } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { aiSearchClients, ClientSearchResult } from "@/app/client-search-actions";

interface ClientAiSearchBarProps {
  advisorId: number;
  placeholder?: string;
  helperText?: string;
  onResult: (result: ClientSearchResult | null) => void;
}

const DEFAULT_PLACEHOLDER =
  "e.g. Aggressive clients with weak 1Y returns or near retirement";

export function ClientAiSearchBar({
  advisorId,
  placeholder,
  helperText,
  onResult,
}: ClientAiSearchBarProps) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hasResult, setHasResult] = useState(false);

  const runSearch = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setHasResult(false);
      onResult(null);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await aiSearchClients(advisorId, trimmed);
        setHasResult(true);
        onResult(result);
      } catch (err) {
        console.error("[ClientAiSearchBar] search failed", err);
        setError("AI search failed. Please try again.");
        setHasResult(false);
        onResult(null);
      }
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runSearch(query);
  };

  const handleClear = () => {
    setQuery("");
    setError(null);
    setHasResult(false);
    onResult(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label
        htmlFor={`ai-client-search-${advisorId}`}
        className="flex items-center gap-1.5 text-sm font-medium text-foreground"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Ask AI about your clients
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          id={`ai-client-search-${advisorId}`}
          placeholder={placeholder ?? DEFAULT_PLACEHOLDER}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={isPending}
          className="flex-1"
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending || query.trim().length === 0}>
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching
              </span>
            ) : (
              "Search"
            )}
          </Button>
          {(hasResult || query.length > 0) && !isPending && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              aria-label="Clear AI search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {helperText && !error && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
