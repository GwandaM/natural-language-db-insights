"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { ClientRow } from "@/lib/advisor-data";
import { PortfolioDeepDiveSnapshot } from "@/lib/portfolio-deepdive";
import { fetchPortfolioDeepDive } from "@/app/portfolio-actions";
import { AllocationDonut } from "./AllocationDonut";
import { RiskReturnScatter } from "./RiskReturnScatter";
import { TopHoldingsBar } from "./TopHoldingsBar";
import { QuartileStackedBar } from "./QuartileStackedBar";
import { EacHistogram } from "./EacHistogram";
import { VintageBar } from "./VintageBar";
import { formatZar } from "./ChartCard";

// The map bundle pulls in d3-geo / TopoJSON, so lazy-load it client-side only.
const GlobalExposureMap = dynamic(
  () => import("./GlobalExposureMap").then((mod) => mod.GlobalExposureMap),
  {
    ssr: false,
    loading: () => (
      <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-center h-[420px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

type ScopeMode = "advisor" | "client";

interface PortfolioDeepDivesTabProps {
  advisorId: number;
  clients: ClientRow[];
  initialSnapshot: PortfolioDeepDiveSnapshot;
}

export function PortfolioDeepDivesTab({
  advisorId,
  clients,
  initialSnapshot,
}: PortfolioDeepDivesTabProps) {
  const [scope, setScope] = useState<ScopeMode>("advisor");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(
    clients[0]?.client_id ?? null,
  );
  const [snapshot, setSnapshot] =
    useState<PortfolioDeepDiveSnapshot>(initialSnapshot);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scope === "advisor") {
      if (snapshot.scope === "advisor") return;
      setError(null);
      startTransition(async () => {
        try {
          const next = await fetchPortfolioDeepDive(advisorId, null);
          setSnapshot(next);
        } catch (err) {
          console.error("[PortfolioDeepDivesTab] advisor fetch failed", err);
          setError("Could not load whole-book deep dive.");
        }
      });
      return;
    }

    if (selectedClientId == null) return;
    if (snapshot.scope === "client" && snapshot.client_id === selectedClientId) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const next = await fetchPortfolioDeepDive(advisorId, selectedClientId);
        setSnapshot(next);
      } catch (err) {
        console.error("[PortfolioDeepDivesTab] client fetch failed", err);
        setError("Could not load client deep dive.");
      }
    });
  }, [advisorId, scope, selectedClientId, snapshot.scope, snapshot.client_id]);

  const scopeLabel =
    scope === "advisor"
      ? "Whole book"
      : snapshot.client_name ?? "Selected client";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Scope
          </label>
          <div className="flex gap-2">
            {(["advisor", "client"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setScope(mode)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  scope === mode
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode === "advisor" ? "Whole book" : "Per client"}
              </button>
            ))}
          </div>
        </div>

        {scope === "client" && (
          <div className="space-y-2 flex-1 min-w-0">
            <label
              htmlFor="portfolio-client-select"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Client
            </label>
            <select
              id="portfolio-client-select"
              value={selectedClientId ?? ""}
              onChange={(event) =>
                setSelectedClientId(Number(event.target.value) || null)
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={clients.length === 0}
            >
              {clients.length === 0 ? (
                <option value="">No clients</option>
              ) : (
                clients.map((client) => (
                  <option key={client.client_id} value={client.client_id}>
                    {client.client_name}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        <div className="flex items-center gap-4 sm:ml-auto">
          <div className="text-xs text-right">
            <p className="uppercase tracking-wide text-muted-foreground">Viewing</p>
            <p className="font-semibold text-foreground">{scopeLabel}</p>
          </div>
          <div className="text-xs text-right">
            <p className="uppercase tracking-wide text-muted-foreground">Total AUM</p>
            <p className="font-semibold brand-amount">
              {formatZar(snapshot.total_value)}
            </p>
          </div>
          {isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {snapshot.total_value === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          No portfolio data for this scope.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AllocationDonut
              title="Sector Allocation"
              caption="AUM split across fund sectors."
              totalLabel="Total AUM"
              totalValue={snapshot.total_value}
              slices={snapshot.sector_allocation.map((bucket) => ({
                label: bucket.sector_name,
                value: bucket.value,
                pct: bucket.pct,
              }))}
            />
            <AllocationDonut
              title="Wrapper / Product Mix"
              caption="AUM by tax wrapper — RA, TFSA, endowment, living annuity, etc."
              totalLabel="Wrapped AUM"
              totalValue={snapshot.wrapper_mix.reduce((s, r) => s + r.value, 0)}
              slices={snapshot.wrapper_mix.map((bucket) => ({
                label: bucket.display_name,
                value: bucket.value,
                pct: bucket.pct,
              }))}
            />
          </div>

          <GlobalExposureMap
            data={snapshot.geographic_exposure}
            totalValue={snapshot.total_value}
          />

          {scope === "advisor" && (
            <RiskReturnScatter points={snapshot.risk_return_scatter} />
          )}

          <TopHoldingsBar rows={snapshot.top_holdings} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <QuartileStackedBar buckets={snapshot.quartile_distribution} />
            <EacHistogram
              buckets={snapshot.eac_distribution}
              weightedAvgNerPct={snapshot.weighted_avg_ner_pct}
            />
          </div>

          <VintageBar buckets={snapshot.vintage_distribution} />
        </>
      )}
    </div>
  );
}
