import { ArrowRight, CalendarDays, Clock } from "lucide-react";
import Link from "next/link";

const PLACEHOLDER_MEETINGS = [
  { time: "09:00", label: "Sarah Johnson", type: "Annual Review" },
  { time: "11:30", label: "Michael Chen", type: "Portfolio Discussion" },
  { time: "14:00", label: "Team call", type: "Product Update" },
  { time: "15:30", label: "David Nkosi", type: "Onboarding" },
];

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
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{m.label}</p>
              <p className="text-[10px] text-muted-foreground">{m.type}</p>
            </div>
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
