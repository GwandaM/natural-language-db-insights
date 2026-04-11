"use client";

import { useMemo, useState } from "react";
import { ClientRow } from "@/lib/advisor-data";
import { Input } from "@/components/ui/input";
import { ClientIntelligenceTable } from "@/components/dashboard/ClientIntelligenceTable";

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

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
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
  }, [clients, focus, search, status]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col lg:flex-row lg:items-end gap-4">
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

      <ClientIntelligenceTable
        advisorId={advisorId}
        clients={filteredClients}
        title="Client Directory"
        subtitle={`${filteredClients.length} of ${clients.length} clients currently match your filters`}
      />
    </div>
  );
}
