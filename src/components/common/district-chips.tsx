"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { UB_DISTRICTS } from "@/lib/constants";

type ChipMode =
  | {
      /** Render chips as links to /district/[slug]. */
      mode?: "link";
    }
  | {
      /** Render chips as filter toggles. */
      mode: "filter";
      selected?: string | null;
      onSelect: (slug: string | null) => void;
    };

type BaseProps = {
  /** Optional per-district counts shown as a trailing number. */
  counts?: Record<string, number>;
  /** Include an "All" chip at the start (filter mode). */
  showAll?: boolean;
  className?: string;
};

export type DistrictChipsProps = BaseProps & ChipMode;

const CHIP_BASE =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Horizontally scrollable district chips. Two modes:
 *  - "link" (default): each chip navigates to /district/[slug].
 *  - "filter": chips toggle a selection via `onSelect`.
 */
export function DistrictChips(props: DistrictChipsProps) {
  const { counts, className } = props;
  const isFilter = props.mode === "filter";

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      role={isFilter ? "group" : undefined}
      aria-label="Дүүрэг"
    >
      {isFilter && props.showAll && (
        <button
          type="button"
          onClick={() => props.onSelect(null)}
          aria-pressed={!props.selected}
          className={cn(
            CHIP_BASE,
            !props.selected
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-accent",
          )}
        >
          Бүх дүүрэг
        </button>
      )}

      {UB_DISTRICTS.map((d) => {
        const count = counts?.[d.slug];
        const inner = (
          <>
            <MapPin className="size-3.5 opacity-70" aria-hidden />
            {d.nameMn}
            {typeof count === "number" && (
              <span className="text-xs opacity-70">{count}</span>
            )}
          </>
        );

        if (isFilter) {
          const active = props.selected === d.slug;
          return (
            <button
              key={d.slug}
              type="button"
              aria-pressed={active}
              onClick={() => props.onSelect(active ? null : d.slug)}
              className={cn(
                CHIP_BASE,
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-accent",
              )}
            >
              {inner}
            </button>
          );
        }

        return (
          <Link
            key={d.slug}
            href={`/district/${d.slug}`}
            className={cn(
              CHIP_BASE,
              "border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
