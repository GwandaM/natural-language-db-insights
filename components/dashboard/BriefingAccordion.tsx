import { MorningBriefing, MorningBriefingSection } from "@/lib/insights";
import { cn } from "@/lib/utils";

interface BriefingAccordionProps {
  briefing: MorningBriefing;
  highlightSecond?: boolean;
}

interface BriefingCardProps {
  title: string;
  section: MorningBriefingSection | undefined;
  highlight?: boolean;
}

function BriefingCard({ title, section, highlight = false }: BriefingCardProps) {
  return (
    <article
      className={cn(
        "premium-card flex h-full max-h-[240px] flex-col overflow-hidden",
        highlight && "ring-1 ring-[hsl(var(--accent)/0.5)]",
      )}
    >
      <header className="shrink-0 border-b border-border px-4 pb-2 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        {section?.headline && (
          <p className="mt-1 text-sm font-semibold leading-snug text-foreground">
            {section.headline}
          </p>
        )}
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3">
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
    </article>
  );
}

export function BriefingAccordion({
  briefing,
  highlightSecond = true,
}: BriefingAccordionProps) {
  const sectionByKey = Object.fromEntries(
    briefing.sections.map((section) => [section.key, section]),
  ) as Partial<Record<MorningBriefingSection["key"], MorningBriefingSection>>;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <BriefingCard
        title="Market Insights"
        section={sectionByKey["market_insights"]}
      />
      <BriefingCard
        title="Tracking vs Target (YTD)"
        section={sectionByKey["tracking_vs_target"]}
        highlight={highlightSecond}
      />
      <BriefingCard
        title="Today's Agenda"
        section={sectionByKey["todays_agenda"]}
      />
      <BriefingCard
        title="Recent Activity"
        section={sectionByKey["recent_activity"]}
      />
    </div>
  );
}
