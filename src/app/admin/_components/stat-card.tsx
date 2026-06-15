import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export type StatCardProps = {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  /** Visual accent for the icon tile. */
  tone?: "primary" | "secondary" | "success" | "warning" | "soyombo";
  /** Small caption under the value (e.g. "Өнөөдөр +12"). */
  hint?: string;
  /** When set, the whole card becomes a link. */
  href?: string;
  /** Highlight as needing attention (pending queues). */
  attention?: boolean;
  /** Format large numbers compactly (1200 → 1.2K). */
  compact?: boolean;
  className?: string;
};

const TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/15 text-secondary-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  soyombo: "bg-soyombo/10 text-soyombo",
};

/** KPI tile: big number, label, optional icon + hint. Optionally a link. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
  href,
  attention = false,
  compact = false,
  className,
}: StatCardProps) {
  const display =
    typeof value === "number" && compact ? formatCount(value) : value;

  const inner = (
    <Card
      className={cn(
        "flex items-start justify-between gap-3 p-5 transition-shadow",
        href && "hover:shadow-card-hover",
        attention && Number(value) > 0 && "ring-1 ring-inset ring-soyombo/30",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-muted-foreground">
          {label}
        </p>
        <p className="mt-1.5 font-display text-3xl font-bold tracking-tight text-foreground tabular-nums">
          {display}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {Icon && (
        <span
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-xl",
            TONES[tone],
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      )}
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
