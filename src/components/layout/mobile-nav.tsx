"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Map as MapIcon, Heart, User } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Нүүр", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/search",
    label: "Хайх",
    icon: Search,
    match: (p: string) => p.startsWith("/search"),
  },
  {
    href: "/search?view=map",
    label: "Газрын зураг",
    icon: MapIcon,
    match: (p: string) => p.startsWith("/map"),
  },
  {
    href: "/saved",
    label: "Хадгалсан",
    icon: Heart,
    match: (p: string) => p.startsWith("/saved"),
  },
  {
    href: "/profile",
    label: "Профайл",
    icon: User,
    match: (p: string) => p.startsWith("/profile"),
  },
];

/**
 * Bottom tab bar for mobile. Hidden at md+ (where the header nav takes over).
 * Pages should add `pb-16 md:pb-0` so content clears the bar.
 */
export function MobileNav() {
  const pathname = usePathname() || "/";

  return (
    <nav
      aria-label="Үндсэн цэс"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon
                className={cn("size-5", active && "fill-primary/10")}
                aria-hidden
              />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
