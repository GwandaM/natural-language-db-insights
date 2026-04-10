import { Sparkles } from "lucide-react";

interface NarrativeSummaryProps {
  text: string;
}

export function NarrativeSummary({ text }: NarrativeSummaryProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          AI Summary
        </h2>
      </div>
      <p className="text-foreground leading-relaxed">{text}</p>
    </div>
  );
}
