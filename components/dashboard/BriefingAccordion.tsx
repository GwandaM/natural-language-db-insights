"use client";

import { CalendarCheck, ChevronDown, Globe2, Target } from "lucide-react";
import { MorningBriefing, MorningBriefingSection } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { AumTrackingChart } from "./AumTrackingChart";
import { AgendaCalendarPreview } from "./AgendaCalendarPreview";

interface BriefingAccordionProps {
  briefing: MorningBriefing;
}

// Generic card — used for Market Insights
function BriefingCard({
  title,
  section,
  icon: Icon,
  defaultOpen = false,
  highlight = false,
}: {
  title: string;
  section: MorningBriefingSection | undefined;
  icon: React.ElementType;
  defaultOpen?: boolean;
  highlight?: boolean;
}) {
  return (
    <details
      className={cn(
        "premium-card group flex h-full flex-col overflow-hidden",
        highlight && "ring-1 ring-[hsl(var(--accent)/0.5)]",
      )}
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none select-none items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]"
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </p>
          {section?.headline && (
            <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {section.headline}
            </p>
          )}
        </div>
        <ChevronDown
          className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          strokeWidth={2.5}
          aria-hidden
        />
      </summary>
      <div className="max-h-[240px] overflow-y-auto border-t border-border px-4 py-3">
        {section ? (
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            {section.body
              .split("\n\n")
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No data available.</p>
        )}
      </div>
    </details>
  );
}

// Tracking vs Target card — expanded shows AUM line chart
function TrackingCard({
  section,
}: {
  section: MorningBriefingSection | undefined;
}) {
  return (
    <details
      className="premium-card group flex h-full flex-col overflow-hidden ring-1 ring-[hsl(var(--accent)/0.5)]"
    >
      <summary className="flex cursor-pointer list-none select-none items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]"
          aria-hidden
        >
          <Target className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Tracking vs Target (YTD)
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {section?.headline ?? "AUM performance vs last year and budget"}
          </p>
        </div>
        <ChevronDown
          className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          strokeWidth={2.5}
          aria-hidden
        />
      </summary>
      <div className="border-t border-border px-4 py-3">
        <AumTrackingChart />
      </div>
    </details>
  );
}

// Today's Agenda card — expanded shows calendar snapshot with link
function AgendaCard({
  section,
}: {
  section: MorningBriefingSection | undefined;
}) {
  return (
    <details className="premium-card group flex h-full flex-col overflow-hidden">
      <summary className="flex cursor-pointer list-none select-none items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]"
          aria-hidden
        >
          <CalendarCheck className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Today&apos;s Agenda
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            Snapshot of key meetings and actions
          </p>
        </div>
        <ChevronDown
          className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          strokeWidth={2.5}
          aria-hidden
        />
      </summary>
      <div className="border-t border-border px-4 py-3">
        <AgendaCalendarPreview />
      </div>
    </details>
  );
}

export function BriefingAccordion({ briefing }: BriefingAccordionProps) {
  const sectionByKey = Object.fromEntries(
    briefing.sections.map((section) => [section.key, section]),
  ) as Partial<Record<MorningBriefingSection["key"], MorningBriefingSection>>;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <BriefingCard
        title="Market Insights"
        section={sectionByKey["market_insights"]}
        icon={Globe2}
        defaultOpen
      />
      <TrackingCard section={sectionByKey["tracking_vs_target"]} />
      <AgendaCard section={sectionByKey["todays_agenda"]} />
    </div>
  );
}
