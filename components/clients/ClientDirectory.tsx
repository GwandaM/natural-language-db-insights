"use client";

import { useMemo, useState } from "react";
import { ClientRow } from "@/lib/advisor-data";
import { Input } from "@/components/ui/input";
import { ClientIntelligenceTable } from "@/components/dashboard/ClientIntelligenceTable";
import { ClientAiSearchBar } from "@/components/clients/ClientAiSearchBar";
import { ClientAiSearchSummary } from "@/components/clients/ClientAiSearchSummary";
import { ClientSearchResult } from "@/app/client-search-actions";

interface ClientDirectoryProps {
  advisorId: number;
  clients: ClientRow[];
}

type FocusFilter = "all" | "at_risk" | "risk_mismatch" | "bottom_quartile";
type StatusFilter = "all" | "active" | "dormant" | "inactive";

export function ClientDirectory({ advisorId, clients }: ClientDirectoryProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [focus, setFocus] = useState<FocusFilter>("all");
  const [aiResult, setAiResult] = useState<ClientSearchResult | null>(null);

  const aiOrderedIds = useMemo(() => {
    if (!aiResult) return null;
    return aiResult.matches.map((match) => match.client_id);
  }, [aiResult]);

  const filteredClients = useMemo(() => {
    const manualFiltered = clients.filter((client) => {
      const searchMatch =
        search.trim().length === 0 ||
        client.client_name.toLowerCase().includes(search.toLowerCase()) ||
        client.risk_profile.toLowerCase().includes(search.toLowerCase());
      const statusMatch = status === "all" || client.status === status;
      const focusMatch =
        focus === "all" ||
        (focus === "at_risk" && client.status !== "active") ||
        (focus === "risk_mismatch" && client.has_risk_mismatch) ||
        (focus === "bottom_quartile" && client.avg_quartile > 3);

      return searchMatch && statusMatch && focusMatch;
    });

    if (!aiOrderedIds) return manualFiltered;

    const allowed = new Set(aiOrderedIds);
    const intersected = manualFiltered.filter((client) => allowed.has(client.client_id));
    intersected.sort(
      (a, b) => aiOrderedIds.indexOf(a.client_id) - aiOrderedIds.indexOf(b.client_id),
    );
    return intersected;
  }, [aiOrderedIds, clients, focus, search, status]);

  const subtitle = aiResult
    ? `${filteredClients.length} of ${clients.length} clients match your AI query${
        search || status !== "all" || focus !== "all" ? " (intersected with filters)" : ""
      }`
    : `${filteredClients.length} of ${clients.length} clients currently match your filters`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <ClientAiSearchBar
          advisorId={advisorId}
          helperText="Try: “post-retirement clients with drawdown above 6%” or “dormant clients with R1M+ AUM”."
          onResult={setAiResult}
        />

        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="client-search">
              Search clients
            </label>
            <Input
              id="client-search"
              placeholder="Search by client name or risk profile"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="client-status-filter">
              Status
            </label>
            <select
              id="client-status-filter"
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="dormant">Dormant</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="client-focus-filter">
              Focus
            </label>
            <select
              id="client-focus-filter"
              value={focus}
              onChange={(event) => setFocus(event.target.value as FocusFilter)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All clients</option>
              <option value="at_risk">At-risk relationships</option>
              <option value="risk_mismatch">Risk mismatches</option>
              <option value="bottom_quartile">Bottom quartile holdings</option>
            </select>
          </div>
        </div>
      </div>

      {aiResult && <ClientAiSearchSummary result={aiResult} />}

      <ClientIntelligenceTable
        advisorId={advisorId}
        clients={filteredClients}
        title="Client Directory"
        subtitle={subtitle}
      />
    </div>
  );
}
