"use client";

import { useState } from "react";
import { ClientRow } from "@/lib/advisor-data";
import { AdvisorAlerts } from "./AdvisorAlerts";
import { ClientIntelligenceTable } from "./ClientIntelligenceTable";

type SortMode = "aum" | "commission" | "risk";

interface Props {
  clients: ClientRow[];
}

export function AdvisorAlertWrapper({ clients }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("aum");

  return (
    <div className="space-y-4">
      <AdvisorAlerts clients={clients} onSortChange={setSortMode} />
      <ClientIntelligenceTable
        clients={clients}
        externalSort={sortMode}
        onSortChange={setSortMode}
      />
    </div>
  );
}
