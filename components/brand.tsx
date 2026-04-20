import { cn } from "@/lib/utils";

export function BrandBadge({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
        dims,
        className,
      )}
      aria-hidden
    >
      <svg
        className={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 7l6 6 6-6" />
        <path d="M6 13l6 6 6-6" />
      </svg>
    </span>
  );
}

export function Avatar({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-sm ring-2 ring-white/60 dark:ring-white/10",
        className,
      )}
    >
      {initials}
    </span>
  );
}
