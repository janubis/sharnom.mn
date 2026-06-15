import * as React from "react";
import Link from "next/link";
import { SearchX, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type EmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type EmptyStateProps = {
  /** lucide icon component (defaults to SearchX). */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Primary call-to-action. */
  action?: EmptyStateAction;
  /** Secondary call-to-action. */
  secondaryAction?: EmptyStateAction;
  /** Compact padding for inline/empty card slots. */
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
};

function ActionButton({
  action,
  variant,
}: {
  action: EmptyStateAction;
  variant: "default" | "outline";
}) {
  if (action.href) {
    return (
      <Button asChild variant={variant}>
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }
  return (
    <Button variant={variant} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

/**
 * Friendly empty state on a felt-textured surface with a subtle ulzii motif.
 * Pair the `title`/`description` with `empty.*` i18n keys where appropriate.
 */
export function EmptyState({
  icon: Icon = SearchX,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "felt-surface flex flex-col items-center justify-center rounded-2xl border border-border text-center",
        compact ? "px-6 py-10" : "px-6 py-16 sm:py-20",
        className,
      )}
    >
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
        <Icon className="size-7" aria-hidden />
      </span>
      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {children}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action && <ActionButton action={action} variant="default" />}
          {secondaryAction && (
            <ActionButton action={secondaryAction} variant="outline" />
          )}
        </div>
      )}
    </div>
  );
}
