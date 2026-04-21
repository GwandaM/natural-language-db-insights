import { Globe, Target, TrendingUp, Activity } from "lucide-react";
import { MorningBriefing, MorningBriefingSection } from "@/lib/insights";
import { BrandBadge } from "@/components/brand";

const SECTION_META: Record<
  MorningBriefingSection["key"],
  { icon: React.ElementType; accent: string; iconBg: string; border: string; headerBg: string }
> = {
  market_insights: {
    icon: Globe,
    accent: "text-violet-700 dark:text-violet-400",
    iconBg: "text-violet-600 dark:text-violet-400",
    border: "border-violet-200 dark:border-violet-800",
    headerBg: "bg-violet-50/60 dark:bg-violet-950/30",
  },
  todays_agenda: {
    icon: Target,
    accent: "text-red-700 dark:text-red-400",
    iconBg: "text-red-600 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    headerBg: "bg-red-50/60 dark:bg-red-950/30",
  },
  tracking_vs_target: {
    icon: TrendingUp,
    accent: "text-emerald-700 dark:text-emerald-400",
    iconBg: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
    headerBg: "bg-emerald-50/60 dark:bg-emerald-950/30",
  },
  recent_activity: {
    icon: Activity,
    accent: "text-amber-700 dark:text-amber-400",
    iconBg: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    headerBg: "bg-amber-50/60 dark:bg-amber-950/30",
  },
};

function SectionCard({ section }: { section: MorningBriefingSection }) {
  const meta = SECTION_META[section.key] ?? SECTION_META.todays_agenda;
  const Icon = meta.icon;
  const headline = section.headline ?? section.title;

  return (
    <details className={`group rounded-xl border ${meta.border} bg-card overflow-hidden`}>
      <summary
        className={`
          flex items-start gap-2.5 px-4 py-3 cursor-pointer select-none
          ${meta.headerBg} list-none
          [&::-webkit-details-marker]:hidden
        `}
      >
        {/* Icon */}
        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${meta.iconBg}`} />

        {/* Label + headline */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
            {section.title}
          </p>
          <p className={`text-sm font-semibold leading-snug ${meta.accent}`}>
            {headline}
          </p>
        </div>

        {/* Chevron */}
        <svg
          className="h-4 w-4 shrink-0 mt-1 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>

      {/* Body — visible when open */}
      <div className="px-4 pb-4 pt-2">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {section.body}
        </p>
      </div>
    </details>
  );
}

interface Props {
  briefing: MorningBriefing;
}

export function NarrativeSummary({ briefing }: Props) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
      {/* Intro */}
      <div className="flex items-start gap-3">
        <BrandBadge />
        <div>
          <p className="text-sm font-semibold text-primary">Morning Briefing</p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
            {briefing.intro}
          </p>
        </div>
      </div>

      {/* 4 expandable section cards — 2 columns on lg, 1 on sm */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {briefing.sections.map((section) => (
          <SectionCard key={section.key} section={section} />
        ))}
      </div>
    </div>
  );
}
