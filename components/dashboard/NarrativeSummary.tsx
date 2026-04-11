import { Sparkles } from "lucide-react";
import { MorningBriefing } from "@/lib/insights";

interface NarrativeSummaryProps {
  briefing: MorningBriefing;
}

export function NarrativeSummary({ briefing }: NarrativeSummaryProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Morning Briefing
          </h2>
          <p className="text-lg font-semibold text-foreground leading-snug">
            {briefing.intro}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {briefing.sections.map((section) => (
          <div
            key={section.key}
            className="rounded-xl border border-border bg-muted/20 p-4"
          >
            <h3 className="text-sm font-semibold text-foreground mb-2">
              {section.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-6">
              {section.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
