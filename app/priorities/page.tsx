import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default function PrioritiesPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <header className="premium-card px-6 py-6 sm:px-8 sm:py-7">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>
        <h1 className="mt-3 text-3xl sm:text-[34px] font-bold tracking-tight text-foreground leading-tight">
          Priority List
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Full ranked list of priority clients for the selected advisor.
        </p>
      </header>

      <div className="premium-card flex min-h-[320px] items-center justify-center px-6 py-10 text-center">
        <div className="max-w-md space-y-2">
          <p className="text-sm font-semibold text-foreground">
            Nothing here yet
          </p>
          <p className="text-sm text-muted-foreground">
            The full priority client list will live here. For now, see the top
            five on the dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
