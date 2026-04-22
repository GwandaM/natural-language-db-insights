"use client";

import { useMemo, useState } from "react";
import { ClientRow } from "@/lib/advisor-data";
import { AdvisorAlerts } from "./AdvisorAlerts";
import { ClientIntelligenceTable } from "./ClientIntelligenceTable";
import { ClientAiSearchBar } from "@/components/clients/ClientAiSearchBar";
import { ClientAiSearchSummary } from "@/components/clients/ClientAiSearchSummary";
import { ClientSearchResult } from "@/app/client-search-actions";

type SortMode = "aum" | "commission" | "risk";

interface Props {
  advisorId: number;
  clients: ClientRow[];
}

export function AdvisorAlertWrapper({ advisorId, clients }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("aum");
  const [aiResult, setAiResult] = useState<ClientSearchResult | null>(null);

  const tableClients = useMemo(() => {
    if (!aiResult) return clients;
    const orderedIds = aiResult.matches.map((match) => match.client_id);
    const allowed = new Set(orderedIds);
    const filtered = clients.filter((client) => allowed.has(client.client_id));
    filtered.sort(
      (a, b) => orderedIds.indexOf(a.client_id) - orderedIds.indexOf(b.client_id),
    );
    return filtered;
  }, [aiResult, clients]);

  const tableSubtitle = aiResult
    ? `${tableClients.length} of ${clients.length} clients match your AI query`
    : undefined;

  return (
    <div className="space-y-4">
      <AdvisorAlerts clients={clients} onSortChange={setSortMode} />

      <div className="rounded-xl border border-border bg-card p-4">
        <ClientAiSearchBar
          advisorId={advisorId}
          helperText="Ask in plain language — e.g. “top-commission opportunities near retirement” or “inactive clients worth reviving”."
          onResult={setAiResult}
        />
      </div>

      {aiResult && <ClientAiSearchSummary result={aiResult} />}

      <ClientIntelligenceTable
        advisorId={advisorId}
        clients={tableClients}
        externalSort={sortMode}
        onSortChange={setSortMode}
        subtitle={tableSubtitle}
      />
    </div>
  );
}
