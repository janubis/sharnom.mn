import * as React from "react";

import { cn } from "@/lib/utils";

export type MiniBar = { label: string; value: number };

/**
 * A lightweight, dependency-free daily bar chart. Server-renderable: each bar
 * is a div sized as a percentage of the series max. Suitable for the owner
 * dashboard's 30-day profile-view trend.
 */
export function MiniBars({
  data,
  className,
  emptyLabel = "Мэдээлэл алга байна",
}: {
  data: MiniBar[];
  className?: string;
  emptyLabel?: string;
}) {
  const max = data.reduce((m, d) => Math.max(m, d.value), 0);

  if (data.length === 0 || max === 0) {
    return (
      <div
        className={cn(
          "flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn("flex h-40 items-end gap-1", className)}>
      {data.map((d, i) => {
        const pct = Math.max(4, Math.round((d.value / max) * 100));
        return (
          <div
            key={`${d.label}-${i}`}
            className="group relative flex flex-1 flex-col items-center justify-end"
            title={`${d.label}: ${d.value}`}
          >
            <div
              className="w-full rounded-t-md bg-primary/70 transition-colors group-hover:bg-primary"
              style={{ height: `${pct}%` }}
              aria-hidden
            />
            <span className="sr-only">
              {d.label}: {d.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
