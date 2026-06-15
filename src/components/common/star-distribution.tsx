import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatRating, formatCount } from "@/lib/utils";
import { RatingStars } from "@/components/business/rating-stars";

export type StarDistributionProps = {
  /**
   * Counts keyed by star value. Accepts either an object map
   * { 5: n, 4: n, ... } or a 5-length array where index 0 = 1 star.
   */
  counts: Record<number, number> | number[];
  /** Overall average; computed from counts when omitted. */
  average?: number;
  /** Total reviews; summed from counts when omitted. */
  total?: number;
  /** Make each row a filter button. */
  onSelect?: (star: number) => void;
  className?: string;
};

function normalize(counts: Record<number, number> | number[]) {
  const map: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (Array.isArray(counts)) {
    counts.forEach((c, i) => {
      const star = i + 1;
      if (star >= 1 && star <= 5) map[star] = c ?? 0;
    });
  } else {
    for (let s = 1; s <= 5; s++) map[s] = counts[s] ?? 0;
  }
  return map;
}

/**
 * 5→1 breakdown bar chart for review summaries. Shows the average + total
 * alongside per-star proportion bars.
 */
export function StarDistribution({
  counts,
  average,
  total,
  onSelect,
  className,
}: StarDistributionProps) {
  const map = normalize(counts);
  const sum = total ?? Object.values(map).reduce((a, b) => a + b, 0);
  const avg =
    average ??
    (sum > 0
      ? Object.entries(map).reduce((acc, [s, c]) => acc + Number(s) * c, 0) / sum
      : 0);

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center", className)}>
      {/* Average summary */}
      <div className="flex shrink-0 flex-col items-center justify-center gap-1 sm:w-36">
        <span className="font-display text-4xl font-bold leading-none text-foreground">
          {formatRating(avg)}
        </span>
        <RatingStars rating={avg} size="sm" />
        <span className="text-sm text-muted-foreground">
          {formatCount(sum)} сэтгэгдэл
        </span>
      </div>

      {/* Bars */}
      <div className="flex flex-1 flex-col gap-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const c = map[star] ?? 0;
          const pct = sum > 0 ? (c / sum) * 100 : 0;
          const RowTag = onSelect ? "button" : "div";
          return (
            <RowTag
              key={star}
              {...(onSelect
                ? {
                    type: "button" as const,
                    onClick: () => onSelect(star),
                    "aria-label": `${star} оддыг шүүх`,
                  }
                : {})}
              className={cn(
                "flex w-full items-center gap-2 rounded-md text-sm",
                onSelect &&
                  "px-1 py-0.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span className="flex w-10 shrink-0 items-center justify-end gap-0.5 text-muted-foreground">
                {star}
                <Star className="size-3 fill-secondary text-secondary" />
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-secondary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {formatCount(c)}
              </span>
            </RowTag>
          );
        })}
      </div>
    </div>
  );
}
