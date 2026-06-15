import { cn } from "@/lib/utils";
import { PRICE_LEVELS } from "@/lib/constants";

export type PriceLevelProps = {
  /** 1..4 (tögrög symbols). Null/0 renders nothing. */
  priceLevel: number | null | undefined;
  /** Show the inactive symbols dimmed for context. */
  showRange?: boolean;
  className?: string;
};

/**
 * Renders the price level as ₮ symbols. With `showRange`, the inactive
 * symbols are dimmed (₮₮·· style) so the level reads at a glance.
 */
export function PriceLevel({
  priceLevel,
  showRange = false,
  className,
}: PriceLevelProps) {
  if (!priceLevel || priceLevel < 1) return null;
  const level = Math.min(4, Math.max(1, Math.round(priceLevel)));
  const hint = PRICE_LEVELS.find((p) => p.value === level)?.hint;

  if (!showRange) {
    return (
      <span
        className={cn("font-medium text-foreground", className)}
        title={hint}
        aria-label={`Үнийн түвшин: ${hint}`}
      >
        {"₮".repeat(level)}
      </span>
    );
  }

  return (
    <span
      className={cn("font-medium tracking-tight", className)}
      title={hint}
      aria-label={`Үнийн түвшин: ${hint}`}
    >
      <span className="text-foreground">{"₮".repeat(level)}</span>
      <span className="text-muted-foreground/40">{"₮".repeat(4 - level)}</span>
    </span>
  );
}
