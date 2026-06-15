import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * A single KPI tile: an icon chip, the formatted value and a label. Used on the
 * owner dashboard to summarise 30-day engagement across owned businesses.
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint?: string;
  tone?: "primary" | "secondary" | "success" | "soyombo";
  className?: string;
}) {
  const toneClass: Record<NonNullable<typeof tone>, string> = {
    primary: "bg-primary/10 text-primary ring-primary/15",
    secondary: "bg-secondary/15 text-secondary-foreground ring-secondary/25",
    success: "bg-success/15 text-success ring-success/25",
    soyombo: "bg-soyombo/10 text-soyombo ring-soyombo/20",
  };

  return (
    <Card
      className={cn(
        "flex flex-col gap-3 p-5 transition-shadow hover:shadow-card-hover",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-xl ring-1 ring-inset",
            toneClass[tone],
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <div>
        <div className="font-display text-3xl font-bold tracking-tight text-foreground">
          {formatCount(value)}
        </div>
        <div className="mt-0.5 text-sm font-medium text-muted-foreground">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground/80">{hint}</div>}
      </div>
    </Card>
  );
}
