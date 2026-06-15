"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, LocateFixed, Loader2, Store } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

type AutocompleteResult = {
  suggestions: string[];
  businesses: { slug: string; name: string }[];
};

export type SearchBarProps = {
  /** "hero" = large stacked/inline; "compact" = single-line header trigger. */
  variant?: "hero" | "compact";
  /** Initial values (e.g. on the search page). */
  defaultQuery?: string;
  defaultWhere?: string;
  /** Override where results go (defaults to /search). */
  action?: string;
  className?: string;
  /** Autofocus the query field on mount. */
  autoFocus?: boolean;
};

/** Small in-component debounce. */
function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

async function fetchAutocomplete(q: string): Promise<AutocompleteResult> {
  const res = await fetch(
    `/api/search/autocomplete?q=${encodeURIComponent(q)}`,
  );
  const json = (await res.json()) as {
    ok: boolean;
    data?: AutocompleteResult;
  };
  return json.data ?? { suggestions: [], businesses: [] };
}

/**
 * Dual-field discovery search ("Юу хайж байна?" + "Хаана?") with a
 * current-location button and debounced autocomplete (suggestions + matching
 * businesses) backed by TanStack Query. Submits to /search via query params.
 */
export function SearchBar({
  variant = "hero",
  defaultQuery = "",
  defaultWhere = "",
  action = "/search",
  className,
  autoFocus = false,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState(defaultQuery);
  const [where, setWhere] = React.useState(defaultWhere);
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locating, setLocating] = React.useState(false);
  const [openSuggest, setOpenSuggest] = React.useState(false);
  const [active, setActive] = React.useState(-1);

  const debounced = useDebounced(query.trim(), 250);
  const enabled = debounced.length >= 2 && openSuggest;

  const { data, isFetching } = useQuery({
    queryKey: ["autocomplete", debounced],
    queryFn: () => fetchAutocomplete(debounced),
    enabled,
    staleTime: 60_000,
  });

  const suggestions = data?.suggestions ?? [];
  const businesses = data?.businesses ?? [];
  const hasResults = suggestions.length + businesses.length > 0;

  function submit(overrideQuery?: string) {
    const params = new URLSearchParams();
    const q = (overrideQuery ?? query).trim();
    if (q) params.set("q", q);
    if (where.trim()) params.set("district", where.trim());
    if (coords) {
      params.set("lat", String(coords.lat));
      params.set("lng", String(coords.lng));
      params.set("sort", "nearest");
    }
    setOpenSuggest(false);
    router.push(`${action}?${params.toString()}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setWhere("Миний байршил");
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!openSuggest || !hasResults) return;
    const total = suggestions.length + businesses.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + total) % total);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      if (active < suggestions.length) {
        const s = suggestions[active];
        if (s) {
          setQuery(s);
          submit(s);
        }
      } else {
        const b = businesses[active - suggestions.length];
        if (b) {
          setOpenSuggest(false);
          router.push(`/business/${b.slug}`);
        }
      }
    } else if (e.key === "Escape") {
      setOpenSuggest(false);
    }
  }

  const fieldWrap =
    variant === "hero"
      ? "flex flex-col gap-2 rounded-2xl bg-card p-2 shadow-card sm:flex-row sm:items-center sm:rounded-full"
      : "flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm";

  return (
    <form onSubmit={onSubmit} className={cn("w-full", className)}>
      <Popover open={openSuggest && enabled && hasResults} onOpenChange={setOpenSuggest}>
        <div className={fieldWrap}>
          {/* What */}
          <PopoverAnchor asChild>
            <div className="relative flex flex-1 items-center gap-2 px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpenSuggest(true);
                  setActive(-1);
                }}
                onFocus={() => setOpenSuggest(true)}
                onKeyDown={onKeyDown}
                autoFocus={autoFocus}
                placeholder="Юу хайж байна?"
                aria-label="Юу хайж байна?"
                className="h-11 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {isFetching && (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              )}
            </div>
          </PopoverAnchor>

          {variant === "hero" && (
            <span className="hidden h-7 w-px bg-border sm:block" aria-hidden />
          )}

          {/* Where */}
          <div className="relative flex flex-1 items-center gap-2 px-3">
            <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={where}
              onChange={(e) => {
                setWhere(e.target.value);
                if (coords) setCoords(null);
              }}
              placeholder="Хаана?"
              aria-label="Хаана?"
              className="h-11 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={useMyLocation}
              aria-label="Миний байршлыг ашиглах"
              title="Миний байршлыг ашиглах"
              className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {locating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LocateFixed className="size-4" />
              )}
            </button>
          </div>

          <Button
            type="submit"
            size={variant === "hero" ? "lg" : "default"}
            className={cn(
              "shrink-0",
              variant === "hero" ? "rounded-full sm:rounded-full" : "rounded-full",
            )}
          >
            <Search className="size-4" />
            <span className={variant === "compact" ? "sr-only sm:not-sr-only" : ""}>
              Хайх
            </span>
          </Button>
        </div>

        <PopoverContent
          align="start"
          sideOffset={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[--radix-popover-trigger-width] max-w-md p-1.5"
        >
          {suggestions.length > 0 && (
            <div className="mb-1">
              <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                Санал болгож буй
              </p>
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery(s);
                    submit(s);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    active === i ? "bg-accent" : "hover:bg-accent",
                  )}
                >
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </div>
          )}

          {businesses.length > 0 && (
            <div>
              <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                Бизнесүүд
              </p>
              {businesses.map((b, i) => {
                const idx = suggestions.length + i;
                return (
                  <button
                    key={b.slug}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setOpenSuggest(false);
                      router.push(`/business/${b.slug}`);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                      active === idx ? "bg-accent" : "hover:bg-accent",
                    )}
                  >
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Store className="size-4" />
                    </span>
                    <span className="truncate font-medium">{b.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </form>
  );
}
