import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type PaginationProps = {
  page: number;
  /** Total item count (preferred — derives page count with pageSize). */
  total?: number;
  pageSize?: number;
  /** Explicit total pages (used when `total` is not available). */
  totalPages?: number;
  /**
   * Builds the href for a page. Receives the target page number. Keep existing
   * search params and only swap `page` here, e.g.:
   *   (p) => `/search?${withParam(searchParams, "page", p)}`
   */
  buildHref: (page: number) => string;
  className?: string;
};

/** Compact page-number window with leading/trailing ellipses. */
function pageWindow(current: number, last: number): (number | "…")[] {
  if (last <= 7)
    return Array.from({ length: last }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(last - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < last - 1) out.push("…");
  out.push(last);
  return out;
}

/**
 * SEO-friendly pagination using real links (crawlable, prefetchable).
 * Renders nothing when there is a single page.
 */
export function Pagination({
  page,
  total,
  pageSize,
  totalPages,
  buildHref,
  className,
}: PaginationProps) {
  const last =
    totalPages ??
    (total != null && pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1);

  if (last <= 1) return null;

  const current = Math.min(Math.max(1, page), last);
  const items = pageWindow(current, last);

  const navCls = (disabled: boolean) =>
    cn(
      buttonVariants({ variant: "outline", size: "icon" }),
      disabled && "pointer-events-none opacity-40",
    );

  return (
    <nav
      aria-label="Хуудаслалт"
      className={cn("flex items-center justify-center gap-1.5", className)}
    >
      {current <= 1 ? (
        <span className={navCls(true)} aria-hidden>
          <ChevronLeft className="size-4" />
        </span>
      ) : (
        <Link
          href={buildHref(current - 1)}
          rel="prev"
          aria-label="Өмнөх хуудас"
          className={navCls(false)}
        >
          <ChevronLeft className="size-4" />
        </Link>
      )}

      {items.map((it, i) =>
        it === "…" ? (
          <span
            key={`gap-${i}`}
            className="px-1 text-sm text-muted-foreground"
            aria-hidden
          >
            …
          </span>
        ) : (
          <Link
            key={it}
            href={buildHref(it)}
            aria-label={`${it}-р хуудас`}
            aria-current={it === current ? "page" : undefined}
            className={cn(
              buttonVariants({
                variant: it === current ? "default" : "outline",
                size: "icon",
              }),
              "min-w-10",
            )}
          >
            {it}
          </Link>
        ),
      )}

      {current >= last ? (
        <span className={navCls(true)} aria-hidden>
          <ChevronRight className="size-4" />
        </span>
      ) : (
        <Link
          href={buildHref(current + 1)}
          rel="next"
          aria-label="Дараах хуудас"
          className={navCls(false)}
        >
          <ChevronRight className="size-4" />
        </Link>
      )}
    </nav>
  );
}
