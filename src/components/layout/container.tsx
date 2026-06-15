import * as React from "react";

import { cn } from "@/lib/utils";

type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Render as a different element (e.g. "section", "main"). */
  as?: React.ElementType;
  /** Horizontal max-width. Defaults to the standard content width. */
  size?: "sm" | "default" | "lg" | "full";
};

const SIZES: Record<NonNullable<ContainerProps["size"]>, string> = {
  sm: "max-w-3xl",
  default: "max-w-6xl",
  lg: "max-w-7xl",
  full: "max-w-none",
};

/**
 * Centered max-width wrapper with responsive horizontal padding.
 * The single source of truth for page gutters across the app.
 */
export function Container({
  as: Comp = "div",
  size = "default",
  className,
  ...props
}: ContainerProps) {
  return (
    <Comp
      className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", SIZES[size], className)}
      {...props}
    />
  );
}
