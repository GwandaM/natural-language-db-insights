"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

export function FirstLoadTrigger() {
  const router = useRouter();
  const [status, setStatus] = useState<"generating" | "error">("generating");

  useEffect(() => {
    let cancelled = false;

    async function trigger() {
      try {
        const res = await fetch("/api/refresh-insights", { method: "POST" });
        if (!res.ok) throw new Error("Failed");
        if (!cancelled) {
          // Refresh the server component to pick up the new data
          router.refresh();
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    trigger();
    return () => { cancelled = true; };
  }, [router]);

  if (status === "error") {
    return (
      <div className="text-center space-y-2">
        <p className="text-destructive font-medium">Failed to generate insights.</p>
        <p className="text-sm text-muted-foreground">
          Make sure your database is seeded and try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="flex items-center justify-center gap-2 text-muted-foreground">
        <Sparkles className="h-6 w-6 text-primary" />
        <span className="text-lg font-medium text-foreground">
          Generating AI insights…
        </span>
      </div>
      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
      <p className="text-sm text-muted-foreground max-w-sm">
        Analysing the database and generating advisor briefings for the first time.
        This takes about 15–30 seconds and is then reused until you refresh the insights.
      </p>
    </div>
  );
}
