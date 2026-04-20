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
        "group rounded-2xl border border-border bg-card shadow-sm overflow-hidden",
        className,
      )}
      open={defaultOpen}
    >
      <summary
        className="flex items-start gap-3 px-5 py-4 cursor-pointer list-none select-none hover:bg-muted/40 transition-colors [&::-webkit-details-marker]:hidden"
      >
        {badge && <BrandBadge size="sm" className="mt-0.5" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary leading-snug">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {rightSlot && (
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            {rightSlot}
          </div>
        )}
        <svg
          className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div
        className={cn(
          "border-t border-border",
          padded ? "px-5 py-4" : "",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </details>
  );
}
