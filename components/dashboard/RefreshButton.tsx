"use client";

import { useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

interface RefreshButtonProps {
  advisorId: number;
  generatedAt: string | null;
}

export function RefreshButton({ advisorId, generatedAt }: RefreshButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/refresh-insights?advisor=${advisorId}`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to refresh insights");
      }
      router.refresh();
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  const relativeTime = generatedAt
    ? formatRelative(new Date(generatedAt))
    : null;

  return (
    <div className="flex flex-col items-end gap-0.5 text-right">
      {relativeTime && (
        <span className="text-xs text-muted-foreground">
          Last updated {relativeTime}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--brand-teal-ink))] hover:underline underline-offset-2 disabled:opacity-60 dark:text-[hsl(var(--brand-teal))]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}
