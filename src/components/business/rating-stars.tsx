"use client";

import * as React from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatRating } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";

const STAR_SIZE: Record<Size, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-6",
};

const TEXT_SIZE: Record<Size, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
};

export type RatingStarsProps = {
  /** Rating 0..5; halves supported. */
  rating: number;
  size?: Size;
  /** Show the numeric value next to the stars. */
  showValue?: boolean;
  /** Optional review count rendered in muted text. */
  reviewCount?: number;
  className?: string;
};

/**
 * Read-only star display supporting half stars via a clipped overlay.
 * Server-safe (no interactivity) despite the file-level "use client" — it is
 * also imported by the interactive input below.
 */
export function RatingStars({
  rating,
  size = "md",
  showValue = false,
  reviewCount,
  className,
}: RatingStarsProps) {
  const clamped = Math.max(0, Math.min(5, rating));
  const sizeClass = STAR_SIZE[size];

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <div
        className="relative inline-flex"
        role="img"
        aria-label={`${formatRating(clamped)} / 5`}
      >
        {/* Empty track */}
        <div className="inline-flex gap-0.5 text-muted-foreground/35">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn(sizeClass, "fill-current")} />
          ))}
        </div>
        {/* Filled overlay clipped to the rating width */}
        <div
          className="absolute inset-0 inline-flex gap-0.5 overflow-hidden text-secondary"
          style={{ width: `${(clamped / 5) * 100}%` }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(sizeClass, "shrink-0 fill-current")}
            />
          ))}
        </div>
      </div>

      {showValue && (
        <span className={cn("font-semibold text-foreground", TEXT_SIZE[size])}>
          {formatRating(clamped)}
        </span>
      )}
      {typeof reviewCount === "number" && (
        <span className={cn("text-muted-foreground", TEXT_SIZE[size])}>
          ({reviewCount})
        </span>
      )}
    </div>
  );
}

export type StarRatingInputProps = {
  value: number;
  onChange: (value: number) => void;
  size?: Size;
  /** Disable interaction (e.g. while submitting). */
  disabled?: boolean;
  /** Accessible label for the radiogroup. */
  label?: string;
  className?: string;
};

/**
 * Interactive 1..5 star picker for forms. Keyboard accessible (arrow keys),
 * hover preview, and exposes a radiogroup to assistive tech.
 */
export function StarRatingInput({
  value,
  onChange,
  size = "lg",
  disabled = false,
  label = "Үнэлгээ өгөх",
  className,
}: StarRatingInputProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? value;

  function handleKey(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(5, value + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(1, value - 1));
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKey}
      onMouseLeave={() => setHover(null)}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && "opacity-60",
        className,
      )}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} од`}
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onClick={() => onChange(n)}
          className="rounded-md p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed"
        >
          <Star
            className={cn(
              STAR_SIZE[size],
              "transition-colors",
              n <= shown
                ? "fill-secondary text-secondary"
                : "fill-transparent text-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}
