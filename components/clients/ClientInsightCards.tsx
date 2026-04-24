"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Circle,
  Compass,
  Info,
  PiggyBank,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ClientInsightCard, ClientInsightKey } from "@/lib/client-insights";
import { regenerateClientInsights } from "@/app/cockpit-actions";
import { cn } from "@/lib/utils";

interface ClientInsightCardsProps {
  advisorId: number;
  clientId: number;
  cards: ClientInsightCard[] | null;
  generatedAt: string | null;
  /**
   * Override the per-card list style. Any keys omitted fall back to
   * DEFAULT_CARD_LIST_CONFIG.
   */
  listConfig?: Partial<Record<ClientInsightKey, CardListStyle>>;
}

const ICONS: Record<ClientInsightKey, React.ElementType> = {
  portfolio_review: Compass,
  performance: TrendingUp,
  retirement_insights: PiggyBank,
  recent_activity: Activity,
};

const CARD_ORDER: ClientInsightKey[] = [
  "portfolio_review",
  "performance",
  "retirement_insights",
  "recent_activity",
];

// ---------------------------------------------------------------------------
// Customisation point: tweak how each card's list items render.
//   - ordered: true              -> 1., 2., 3. …
//   - icon: a lucide icon        -> custom bullet glyph
//   - icon: null + ordered:false -> no marker, just indented text
//   - iconClassName              -> tailwind class for icon colour/size
// ---------------------------------------------------------------------------
export interface CardListStyle {
  ordered?: boolean;
  icon?: React.ElementType | null;
  iconClassName?: string;
}

export const DEFAULT_CARD_LIST_CONFIG: Record<ClientInsightKey, CardListStyle> = {
  portfolio_review: {
    icon: Circle,
    iconClassName: "h-1.5 w-1.5 fill-[hsl(var(--brand-teal))] text-[hsl(var(--brand-teal))]",
  },
  performance: {
    icon: ArrowUpRight,
    iconClassName: "h-3.5 w-3.5 text-emerald-500",
  },
  retirement_insights: {
    icon: CheckCircle2,
    iconClassName: "h-3.5 w-3.5 text-amber-500",
  },
  recent_activity: {
    ordered: true,
    icon: null,
  },
};

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

function CardItemList({
  items,
  style,
}: {
  items: string[];
  style: CardListStyle;
}) {
  if (items.length === 0) return null;

  if (style.ordered) {
    return (
      <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="shrink-0 tabular-nums font-semibold text-foreground/80">
              {idx + 1}.
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    );
  }

  const Icon = style.icon;
  return (
    <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2">
          {Icon ? (
            <Icon
              className={cn(
                "mt-1 shrink-0",
                style.iconClassName ?? "h-3 w-3 text-muted-foreground",
              )}
              aria-hidden
            />
          ) : (
            <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function InsightCard({
  card,
  defaultOpen,
  listStyle,
}: {
  card: ClientInsightCard;
  defaultOpen?: boolean;
  listStyle: CardListStyle;
}) {
  const Icon = ICONS[card.key];
  const dimmed = !card.available;
  const items = card.items ?? [];

  return (
    <details
      className={cn(
        "premium-card group flex h-full flex-col overflow-hidden",
        dimmed && "opacity-75",
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
            {card.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {card.headline}
          </p>
        </div>
        <ChevronDown
          className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          strokeWidth={2.5}
          aria-hidden
        />
      </summary>
      <div className="max-h-[260px] overflow-y-auto border-t border-border px-4 py-3">
        <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
          {card.body
            .split("\n\n")
            .filter(Boolean)
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          <CardItemList items={items} style={listStyle} />
          {!card.available && card.unavailable_reason && (
            <p className="mt-2 rounded-md bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
              <Info className="mr-1 inline h-3 w-3 align-[-2px]" />
              {card.unavailable_reason}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}

function EmptyCard({ cardKey }: { cardKey: ClientInsightKey }) {
  const Icon = ICONS[cardKey];
  const titles: Record<ClientInsightKey, string> = {
    portfolio_review: "Portfolio Review",
    performance: "Performance",
    retirement_insights: "Retirement Insights",
    recent_activity: "Recent Activity",
  };

  return (
    <div className="premium-card flex h-full flex-col items-start gap-2 p-4">
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted/40 text-muted-foreground"
        aria-hidden
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {titles[cardKey]}
      </p>
      <div className="h-3 w-3/4 rounded bg-muted/40" />
      <div className="h-3 w-1/2 rounded bg-muted/30" />
    </div>
  );
}

export function ClientInsightCards({
  advisorId,
  clientId,
  cards,
  generatedAt,
  listConfig,
}: ClientInsightCardsProps) {
  const resolvedListConfig: Record<ClientInsightKey, CardListStyle> = {
    ...DEFAULT_CARD_LIST_CONFIG,
    ...(listConfig ?? {}),
  };
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    startTransition(async () => {
      try {
        await regenerateClientInsights(advisorId, clientId);
        router.refresh();
      } finally {
        setTimeout(() => setLoading(false), 500);
      }
    });
  };

  const relativeTime = generatedAt
    ? formatRelative(new Date(generatedAt))
    : null;

  const cardsByKey = new Map(cards?.map((card) => [card.key, card]) ?? []);
  const busy = loading || isPending;

  return (
    <section className="premium-card space-y-4 px-5 py-5 sm:px-6 sm:py-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Sparkles
              className="h-4 w-4 text-[hsl(var(--accent))]"
              strokeWidth={2.25}
              aria-hidden
            />
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              AI Client Insights
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            LLM-generated snapshot covering portfolio, performance, retirement,
            and recent activity.
          </p>
        </div>
        <div className="flex flex-col items-start gap-0.5 text-left sm:items-end sm:text-right">
          {relativeTime && (
            <span className="text-[11px] text-muted-foreground">
              Last updated {relativeTime}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--brand-teal-ink))] underline-offset-2 hover:underline disabled:opacity-60 dark:text-[hsl(var(--brand-teal))]"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", busy && "animate-spin")}
            />
            {cards ? "Regenerate" : "Generate"}
          </button>
        </div>
      </header>

      {cards ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CARD_ORDER.map((key, idx) => {
            const card = cardsByKey.get(key);
            if (!card) return <EmptyCard key={key} cardKey={key} />;
            return (
              <InsightCard
                key={key}
                card={card}
                defaultOpen={idx === 0}
                listStyle={resolvedListConfig[key]}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Client insights have not been generated yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click <span className="font-semibold">Generate</span> above to run
            the AI analysis.
          </p>
        </div>
      )}
    </section>
  );
}
