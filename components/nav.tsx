"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, BarChart2, Search, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { BrandBadge } from "@/components/brand";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart2 },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/query", label: "Advanced Analysis", icon: Search },
];

export function Nav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <header className="border-b border-border bg-card/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-primary">
            <BrandBadge size="sm" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Advisor Cockpit
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {active && (
                    <span className="absolute inset-x-2 -bottom-[11px] h-0.5 rounded-full bg-[hsl(var(--brand-teal))]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "dark" ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
    </header>
  );
}
