import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionCategory {
  key: string;
  label: string;
  count: number;
  href: string;
  highlight?: boolean;
}

interface TodayActionsListProps {
  categories: ActionCategory[];
}

export function TodayActionsList({ categories }: TodayActionsListProps) {
  return (
    <section className="premium-card flex h-full flex-col overflow-hidden">
      <header className="px-5 pt-5 pb-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Today&apos;s Actions
        </h2>
      </header>

      <ul className="divide-y divide-border">
        {categories.map((category) => (
          <li key={category.key}>
            <Link
              href={category.href}
              className={cn(
                "group/row flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40",
                category.highlight && "row-highlight",
              )}
            >
              <span className="text-sm font-medium text-foreground">
                {category.label}
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular text-sm font-semibold text-foreground">
                  {category.count} {category.count === 1 ? "Client" : "Clients"}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover/row:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
