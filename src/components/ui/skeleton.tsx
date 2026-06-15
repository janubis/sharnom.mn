import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Uses the brand `.shimmer` sweep (defined in globals.css)
 * over a muted surface. Compose width/height/shape via className.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("shimmer rounded-xl bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
