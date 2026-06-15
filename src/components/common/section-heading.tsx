import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type SectionHeadingProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional "Бүгдийг үзэх" link. */
  href?: string;
  /** Override the link label (defaults to "Бүгдийг үзэх"). */
  linkLabel?: string;
  /** Heading level for semantics. */
  as?: "h1" | "h2" | "h3";
  /** Slot for extra controls on the right (e.g. a sort dropdown). */
  action?: React.ReactNode;
  className?: string;
};

/**
 * Section header: title (+ optional subtitle) on the left, an optional
 * "see all" link or custom action on the right.
 */
export function SectionHeading({
  title,
  subtitle,
  href,
  linkLabel = "Бүгдийг үзэх",
  as: Tag = "h2",
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-4 gap-y-2",
        className,
      )}
    >
      <div className="min-w-0">
        <Tag
          className={cn(
            "font-display font-semibold tracking-tight text-foreground",
            Tag === "h1"
              ? "text-2xl sm:text-3xl"
              : "text-xl sm:text-2xl",
          )}
        >
          {title}
        </Tag>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        )}
      </div>

      {action ??
        (href && (
          <Link
            href={href}
            className="group inline-flex shrink-0 items-center gap-1 rounded-lg text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {linkLabel}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
    </div>
  );
}
