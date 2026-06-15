import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export type PanelProps = {
  title: string;
  description?: string;
  /** Optional "see all" link or action node in the header. */
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
};

/** Card with a titled header — the building block for dashboard/analytics panels. */
export function Panel({
  title,
  description,
  action,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className={cn("flex-1 px-5 pb-5", bodyClassName)}>{children}</div>
    </Card>
  );
}

/** Small "view all →" link for panel headers. */
export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 text-xs font-medium text-primary hover:underline"
    >
      {children}
    </Link>
  );
}
