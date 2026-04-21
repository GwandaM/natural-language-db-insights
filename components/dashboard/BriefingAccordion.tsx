import Link from "next/link";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import { MorningBriefing, PriorityClientInsight } from "@/lib/insights";
import { cn } from "@/lib/utils";

function formatZar(value: number): string {
  if (value >= 1e9) return `R${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R${(value / 1e3).toFixed(0)}K`;
  return `R${value.toLocaleString()}`;
}

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
      <div className="border-t border-border px-5 pb-5 pt-4">{children}</div>
    </details>
  );
}

interface BriefingAccordionProps {
  briefing: MorningBriefing;
  advisorId: number;
  highlightSecond?: boolean;
}

function joinSections(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join("\n\n");
}

function PriorityClientsBody({
  clients,
  advisorId,
}: {
  clients: PriorityClientInsight[];
  advisorId: number;
}) {
  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No priority clients flagged for this advisor.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {clients.map((client) => (
        <Link
          key={client.client_id}
          href={`/clients/${client.client_id}?advisor=${advisorId}`}
          className="group/row flex items-start justify-between gap-4 py-3 transition-colors hover:bg-muted/30 -mx-5 px-5 first:pt-0 last:pb-0"
        >
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {client.client_name}
            </p>
            <p className="text-sm text-muted-foreground">{client.headline}</p>
            <p className="text-xs text-muted-foreground">
              {client.suggested_action}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="brand-amount text-sm font-semibold">
              {formatZar(client.total_aum)}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[hsl(var(--brand-teal-ink))] dark:text-[hsl(var(--brand-teal))]">
              View
              <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function BriefingAccordion({
  briefing,
  advisorId,
  highlightSecond = true,
}: BriefingAccordionProps) {
  const sectionByKey = Object.fromEntries(
    briefing.sections.map((section) => [section.key, section]),
  );

  const investmentPerformance = sectionByKey["investment_performance"];
  const clientBook = sectionByKey["client_book"];
  const economy = sectionByKey["economy_and_markets"];
  const advisorPriorities = sectionByKey["advisor_priorities"];
  const riskOverview = sectionByKey["risk_overview"];
  const clientActivity = sectionByKey["client_activity"];

  const advisor360Headline =
    investmentPerformance?.headline ?? clientBook?.headline ?? "";
  const advisor360Body = joinSections(
    investmentPerformance?.body,
    clientBook?.body,
  );

  const investmentAnalysisHeadline =
    advisorPriorities?.headline ?? riskOverview?.headline ?? "";
  const investmentAnalysisBody = joinSections(
    advisorPriorities?.body,
    riskOverview?.body,
    clientActivity?.body,
  );

  return (
    <div className="space-y-4">
      <AccordionRow
        title="Morning Briefing"
        summary={briefing.intro}
        defaultOpen
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          {briefing.intro}
        </p>
      </AccordionRow>

      <AccordionRow
        title="Advisor 360 Insights"
        summary={advisor360Headline}
        highlight={highlightSecond}
      >
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          {advisor360Body
            .split("\n\n")
            .filter(Boolean)
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
        </div>
      </AccordionRow>

      <AccordionRow
        title="Economic Indicators"
        summary={economy?.headline}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          {economy?.body}
        </p>
      </AccordionRow>

      <AccordionRow
        title="Investment Analysis"
        summary={investmentAnalysisHeadline}
      >
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          {investmentAnalysisBody
            .split("\n\n")
            .filter(Boolean)
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
        </div>
      </AccordionRow>

      <AccordionRow
        title="Priority Clients"
        summary={
          briefing.priority_clients[0]?.headline ??
          "Top relationships ranked by signal strength."
        }
      >
        <PriorityClientsBody
          clients={briefing.priority_clients}
          advisorId={advisorId}
        />
      </AccordionRow>
    </div>
  );
}
