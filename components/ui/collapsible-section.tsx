import { ReactNode } from "react";
import { BrandBadge } from "@/components/brand";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  padded?: boolean;
  badge?: boolean;
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  rightSlot,
  children,
  className,
  bodyClassName,
  padded = true,
  badge = true,
}: CollapsibleSectionProps) {
  return (
    <details
      className={cn(
        "premium-card group overflow-hidden",
        className,
      )}
      open={defaultOpen}
    >
      <summary
        className="relative flex items-start gap-3 px-5 py-4 cursor-pointer list-none select-none hover:bg-muted/30 transition-colors duration-150 [&::-webkit-details-marker]:hidden"
      >
        <span
          aria-hidden
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-transparent group-open:bg-[hsl(var(--brand-teal))] transition-colors duration-200"
        />
        {badge && <BrandBadge size="sm" className="mt-0.5" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary leading-snug">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {rightSlot && (
          <div className="shrink-0 text-right text-xs font-medium text-muted-foreground tabular-nums">
            {rightSlot}
          </div>
        )}
        <svg
          className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div
        className={cn(
          "border-t border-border animate-in fade-in slide-in-from-top-1 duration-150",
          padded ? "px-5 py-4" : "",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </details>
  );
}
