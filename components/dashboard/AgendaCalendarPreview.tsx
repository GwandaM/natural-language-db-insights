"use client";

import {
  ArrowRight,
  CalendarDays,
  Clock,
  Eye,
  FileDown,
  FolderOpen,
  MoreHorizontal,
  Play,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface PlaceholderMeeting {
  time: string;
  label: string;
  type: string;
  clientId: number;
}

const PLACEHOLDER_MEETINGS: PlaceholderMeeting[] = [
  { time: "09:00", label: "Sarah Johnson", type: "Annual Review", clientId: 1 },
  { time: "11:30", label: "Michael Chen", type: "Portfolio Discussion", clientId: 2 },
  { time: "14:00", label: "Team call", type: "Product Update", clientId: 3 },
  { time: "15:30", label: "David Nkosi", type: "Onboarding", clientId: 4 },
];

const ADVISOR_ID = 1;

function MeetingActions({ meeting }: { meeting: PlaceholderMeeting }) {
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

  const clientHref = `/clients/${meeting.clientId}?advisor=${ADVISOR_ID}`;
  const communicationsHref = `/clients/${meeting.clientId}/communications?advisor=${ADVISOR_ID}`;
  const startMeetingHref = `/clients/${meeting.clientId}/communications?advisor=${ADVISOR_ID}&startMeeting=1`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label={`Actions for ${meeting.label}`}
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

export function AgendaCalendarPreview() {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        {dateStr}
      </div>

      <div className="space-y-1.5">
        {PLACEHOLDER_MEETINGS.map((m, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2"
          >
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {m.time}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{m.label}</p>
              <p className="text-[10px] text-muted-foreground">{m.type}</p>
            </div>
            <MeetingActions meeting={m} />
          </div>
        ))}
      </div>

      <Link
        href="#calendar"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        View full calendar <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
