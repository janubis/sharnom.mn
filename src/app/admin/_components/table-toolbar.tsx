"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FilterOption = { value: string; label: string };

export type FilterSelect = {
  /** Query-string key. */
  param: string;
  placeholder: string;
  options: FilterOption[];
  className?: string;
};

export type TableToolbarProps = {
  /** Show a debounced free-text search bound to `?q=`. */
  search?: boolean;
  searchPlaceholder?: string;
  selects?: FilterSelect[];
  className?: string;
  children?: React.ReactNode;
};

const ALL = "__all__";

/**
 * URL-driven filter toolbar. Updating any control rewrites the query string
 * (resetting `page` to 1) and lets the server component re-render with the new
 * filters — keeps the table SSR-friendly and shareable/bookmarkable.
 */
export function TableToolbar({
  search = true,
  searchPlaceholder = "Хайх…",
  selects = [],
  className,
  children,
}: TableToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = React.useState(searchParams.get("q") ?? "");

  const setParam = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "" || value === ALL) params.delete(key);
        else params.set(key, value);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  // Debounce free-text search.
  React.useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => setParam({ q: q || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasActiveFilters =
    (searchParams.get("q") ?? "") !== "" ||
    selects.some((s) => searchParams.get(s.param));

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {search && (
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
      )}

      {selects.map((s) => {
        const value = searchParams.get(s.param) ?? ALL;
        return (
          <Select
            key={s.param}
            value={value}
            onValueChange={(v) => setParam({ [s.param]: v })}
          >
            <SelectTrigger className={cn("w-auto min-w-[150px]", s.className)}>
              <SelectValue placeholder={s.placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{s.placeholder}</SelectItem>
              {s.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}

      {children}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.push(pathname);
          }}
          className="text-muted-foreground"
        >
          <X className="size-4" />
          Цэвэрлэх
        </Button>
      )}
    </div>
  );
}
