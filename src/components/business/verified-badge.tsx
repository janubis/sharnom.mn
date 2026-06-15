import { BadgeCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type VerifiedBadgeProps = {
  /** Icon-only pill (no label) — for tight spots like card corners. */
  iconOnly?: boolean;
  className?: string;
};

/**
 * "Баталгаажсан" trust badge. Uses the primary (khadag-blue) tone with the
 * soyombo accent reserved for the check mark.
 */
export function VerifiedBadge({ iconOnly = false, className }: VerifiedBadgeProps) {
  if (iconOnly) {
    return (
      <span
        title="Баталгаажсан"
        aria-label="Баталгаажсан"
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-primary p-0.5 text-primary-foreground shadow-sm",
          className,
        )}
      >
        <BadgeCheck className="size-4" />
      </span>
    );
  }

  return (
    <Badge
      variant="default"
      className={cn("gap-1 font-semibold", className)}
      aria-label="Баталгаажсан"
    >
      <BadgeCheck />
      Баталгаажсан
    </Badge>
  );
}
