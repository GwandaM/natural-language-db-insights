import { ChevronDown } from "lucide-react";
import { MorningBriefing, MorningBriefingSection } from "@/lib/insights";
import { cn } from "@/lib/utils";

function ChevronCircle() {
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))] transition-transform duration-200 group-open:rotate-180"
      aria-hidden
    >
      <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
    </span>
  );
}

interface AccordionRowProps {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  highlight?: boolean;
  children: React.ReactNode;
}

function AccordionRow({
  title,
  summary,
  defaultOpen = false,
  highlight = false,
  children,
}: AccordionRowProps) {
  return (
    <details
      className={cn(
        "premium-card group overflow-hidden",
        highlight && "ring-1 ring-[hsl(var(--accent)/0.5)]",
      )}
      open={defaultOpen}
    >
      <summary
        className="flex cursor-pointer list-none select-none items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/30 [&::-webkit-details-marker]:hidden"
      >
        <ChevronCircle />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug text-foreground">
            {title}
          </p>
          {summary && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {summary}
            </p>
          )}
        </div>
      </summary>
      <div className="max-h-[240px] overflow-y-auto border-t border-border px-5 pb-5 pt-4">
        {children}
      </div>
    </details>
  );
}

interface BriefingAccordionProps {
  briefing: MorningBriefing;
  highlightSecond?: boolean;
}

function SectionBody({ section }: { section: MorningBriefingSection | undefined }) {
  if (!section) {
    return (
      <p className="text-sm text-muted-foreground">No data available.</p>
    );
  }
  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      {section.body
        .split("\n\n")
        .filter(Boolean)
        .map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
    </div>
  );
}

export function BriefingAccordion({
  briefing,
  highlightSecond = true,
}: BriefingAccordionProps) {
  const sectionByKey = Object.fromEntries(
    briefing.sections.map((section) => [section.key, section]),
  ) as Partial<Record<MorningBriefingSection["key"], MorningBriefingSection>>;

  const marketInsights = sectionByKey["market_insights"];
  const todaysAgenda = sectionByKey["todays_agenda"];
  const trackingVsTarget = sectionByKey["tracking_vs_target"];
  const recentActivity = sectionByKey["recent_activity"];

  return (
    <div className="space-y-4">
      <AccordionRow
        title="Market Insights"
        summary={marketInsights?.headline}
        defaultOpen
      >
        <SectionBody section={marketInsights} />
      </AccordionRow>

      <AccordionRow
        title="Tracking vs Target (YTD)"
        summary={trackingVsTarget?.headline}
        highlight={highlightSecond}
      >
        <SectionBody section={trackingVsTarget} />
      </AccordionRow>

      <AccordionRow
        title="Today's Agenda"
        summary={todaysAgenda?.headline}
      >
        <SectionBody section={todaysAgenda} />
      </AccordionRow>

      <AccordionRow
        title="Recent Activity"
        summary={recentActivity?.headline}
      >
        <SectionBody section={recentActivity} />
      </AccordionRow>
    </div>
  );
}
