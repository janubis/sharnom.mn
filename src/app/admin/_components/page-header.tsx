import * as React from "react";

import { cn } from "@/lib/utils";

export type AdminPageHeaderProps = {
  title: string;
  description?: string;
  /** Right-aligned actions (buttons, links). */
  actions?: React.ReactNode;
  /** Optional content rendered below the title row (e.g. filter bar). */
  children?: React.ReactNode;
  className?: string;
};

/**
 * Standard heading block for every admin page: title + optional description on
 * the left, actions on the right, with a thin ulzii divider beneath.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
  children,
  className,
}: AdminPageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      <div className="ulzii-rule mt-4" aria-hidden />
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
