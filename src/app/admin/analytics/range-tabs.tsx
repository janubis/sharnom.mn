"use client";

/**
 * URL-driven range switcher for the analytics page. Updating the range rewrites
 * `?range=7|30|90` so the server component re-fetches the series for the window.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

const RANGES: { value: string; label: string }[] = [
  { value: "7", label: "7 хоног" },
  { value: "30", label: "30 хоног" },
  { value: "90", label: "90 хоног" },
];

export function RangeTabs({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      role="tablist"
      aria-label="Хугацааны хязгаар"
      className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-card"
    >
      {RANGES.map((r) => {
        const active = r.value === current;
        return (
          <button
            key={r.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => select(r.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
