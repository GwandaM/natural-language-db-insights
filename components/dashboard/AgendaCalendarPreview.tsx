"use client";

import {
  ArrowRight,
  CalendarDays,
  Eye,
  FileDown,
  FolderOpen,
  MoreHorizontal,
  Play,
  AlertTriangle,
  AlertCircle,
  Info,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PriorityClientInsight } from "@/lib/insights";

const TONE_ICON = {
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
} as const;

const TONE_COLOR = {
  high: "text-destructive",
  medium: "text-yellow-500",
  low: "text-muted-foreground",
} as const;

function deriveTone(client: PriorityClientInsight): "high" | "medium" | "low" {
  if (client.status === "dormant") return "high";
  if (client.product_signal?.confidence_level === "high") return "high";
  if (client.product_signal?.confidence_level === "medium") return "medium";
  return "low";
}

function ClientActions({
  client,
  advisorId,
}: {
  client: PriorityClientInsight;
  advisorId: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const clientHref = `/clients/${client.client_id}?advisor=${advisorId}`;
  const communicationsHref = `/clients/${client.client_id}/communications?advisor=${advisorId}`;
  const startMeetingHref = `/clients/${client.client_id}/communications?advisor=${advisorId}&startMeeting=1`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label={`Actions for ${client.client_name}`}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-border bg-card py-1 shadow-lg">
          <Link
            href={clientHref}
            className="flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
            onClick={() => setOpen(false)}
          >
            <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            View client
          </Link>
          <button
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
            onClick={() => setOpen(false)}
          >
            <FileDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            Download meeting pack
          </button>
          <Link
            href={startMeetingHref}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
            onClick={() => setOpen(false)}
          >
            <Play className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            Start meeting
          </Link>
          <Link
            href={communicationsHref}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
            onClick={() => setOpen(false)}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            View communications
          </Link>
        </div>
      )}
    </div>
  );
}

interface AgendaCalendarPreviewProps {
  priorityClients: PriorityClientInsight[];
  advisorId: number;
}

export function AgendaCalendarPreview({
  priorityClients,
  advisorId,
}: AgendaCalendarPreviewProps) {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (priorityClients.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {dateStr}
        </div>
        <p className="text-xs text-muted-foreground">No priority clients identified for today.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        {dateStr}
      </div>

      <div className="space-y-1.5">
        {priorityClients.map((client, i) => {
          const tone = deriveTone(client);
          const ToneIcon = TONE_ICON[tone];
          return (
            <div
              key={client.client_id}
              className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2"
            >
              <span
                className={`flex shrink-0 items-center gap-1 text-[11px] font-medium ${TONE_COLOR[tone]}`}
                title={tone === "high" ? "High priority" : tone === "medium" ? "Medium priority" : "Low priority"}
              >
                <ToneIcon className="h-3 w-3" />
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{client.client_name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{client.suggested_action}</p>
              </div>
              <ClientActions client={client} advisorId={advisorId} />
            </div>
          );
        })}
      </div>

      <Link
        href={`/clients?advisor=${advisorId}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        View all clients <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
