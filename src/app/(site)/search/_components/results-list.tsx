"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { SlidersHorizontal, Loader2, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { SORT_OPTIONS, PAGE_SIZE } from "@/lib/constants";
import type { SortOption } from "@/lib/constants";
import type { SearchResult } from "@/lib/search/types";
import type { MapPin as MapPinType, MapBounds } from "@/lib/maps/provider";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  BusinessCard,
  BusinessCardSkeleton,
} from "@/components/business/business-card";
import { Pagination } from "@/components/common/pagination";
import { EmptyState } from "@/components/common/empty-state";
import { MapListSplit } from "@/components/map/map-list-split";

import {
  FilterPanel,
  type SearchFilters,
  type CategoryOption,
} from "./filter-panel";

export type ResultsListProps = {
  initialResult: SearchResult;
  initialPins: MapPinType[];
  initialQuery: string;
  initialFilters: SearchFilters;
  initialSort: SortOption;
  geo: { lat: number; lng: number } | null;
  categories: CategoryOption[];
};

/* ── URL helpers ──────────────────────────────────────────────────────────── */

function buildParams(opts: {
  query: string;
  filters: SearchFilters;
  sort: SortOption;
  page: number;
  geo: { lat: number; lng: number } | null;
}): URLSearchParams {
  const p = new URLSearchParams();
  const { query, filters, sort, page, geo } = opts;
  if (query) p.set("q", query);
  if (filters.category) p.set("category", filters.category);
  if (filters.district) p.set("district", filters.district);
  if (filters.minRating) p.set("minRating", String(filters.minRating));
  if (filters.price.length) p.set("price", filters.price.join(","));
  if (filters.openNow) p.set("openNow", "true");
  if (filters.verified) p.set("verified", "true");
  if (geo) {
    p.set("lat", String(geo.lat));
    p.set("lng", String(geo.lng));
    if (filters.radius) p.set("radius", String(filters.radius));
  }
  if (sort && sort !== "recommended") p.set("sort", sort);
  if (page > 1) p.set("page", String(page));
  return p;
}

async function fetchSearch(qs: string): Promise<SearchResult> {
  const res = await fetch(`/api/search?${qs}`);
  const json = (await res.json()) as { ok: boolean; data?: SearchResult };
  if (!json.ok || !json.data) throw new Error("search_failed");
  return json.data;
}

async function fetchPins(
  bounds: MapBounds | null,
  filters: SearchFilters,
): Promise<MapPinType[]> {
  if (!bounds) return [];
  const p = new URLSearchParams({
    west: String(bounds.west),
    south: String(bounds.south),
    east: String(bounds.east),
    north: String(bounds.north),
  });
  if (filters.category) p.set("category", filters.category);
  if (filters.district) p.set("district", filters.district);
  if (filters.minRating) p.set("minRating", String(filters.minRating));
  if (filters.openNow) p.set("openNow", "true");
  if (filters.verified) p.set("verified", "true");
  const res = await fetch(`/api/map/pins?${p.toString()}`);
  const json = (await res.json()) as {
    ok: boolean;
    data?: { pins: MapPinType[] };
  };
  return json.ok && json.data ? json.data.pins : [];
}

/* ── Component ───────────────────────────────────────────────────────────── */

export function ResultsList({
  initialResult,
  initialPins,
  initialQuery,
  initialFilters,
  initialSort,
  geo,
  categories,
}: ResultsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query] = React.useState(initialQuery);
  const [filters, setFilters] = React.useState<SearchFilters>(initialFilters);
  const [sort, setSort] = React.useState<SortOption>(initialSort);
  const [page, setPage] = React.useState(initialResult.page);
  const [bounds, setBounds] = React.useState<MapBounds | null>(null);
  const [highlightId, setHighlightId] = React.useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  // The canonical query string for the list query.
  const listQs = React.useMemo(
    () => buildParams({ query, filters, sort, page, geo }).toString(),
    [query, filters, sort, page, geo],
  );

  // Reflect the current state in the address bar (shallow, no scroll jump).
  React.useEffect(() => {
    const next = listQs;
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `/search?${next}` : "/search", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQs]);

  // Results — seeded with the server-rendered first page.
  const isInitialPage =
    listQs === buildParams({
      query,
      filters: initialFilters,
      sort: initialSort,
      page: initialResult.page,
      geo,
    }).toString();

  const { data: result, isFetching } = useQuery({
    queryKey: ["search", listQs],
    queryFn: () => fetchSearch(listQs),
    initialData: isInitialPage ? initialResult : undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // Map pins — refetch as the viewport or filters change.
  const { data: pins } = useQuery({
    queryKey: [
      "pins",
      bounds,
      filters.category,
      filters.district,
      filters.minRating,
      filters.openNow,
      filters.verified,
    ],
    queryFn: () => fetchPins(bounds, filters),
    enabled: bounds != null,
    initialData: initialPins,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const mapPins = pins ?? initialPins;

  const updateFilters = React.useCallback((next: Partial<SearchFilters>) => {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
  }, []);

  const resetFilters = React.useCallback(() => {
    setFilters({
      category: undefined,
      district: undefined,
      minRating: undefined,
      price: [],
      openNow: false,
      verified: false,
      radius: filters.radius,
    });
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSort = (v: string) => {
    setSort(v as SortOption);
    setPage(1);
  };

  const handleBounds = React.useCallback((b: MapBounds) => {
    setBounds(b);
  }, []);

  const heading = query
    ? `“${query}” — хайлтын илэрц`
    : "Бүх газрууд";

  const list = (
    <div className="min-w-0">
      {/* Result header + sort */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {heading}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total > 0 ? `${total} илэрц` : "Илэрц алга"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile filter trigger */}
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden">
                <SlidersHorizontal className="size-4" />
                Шүүлтүүр
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[88vw] max-w-sm overflow-y-auto"
            >
              <SheetTitle className="mb-4">Шүүлтүүр</SheetTitle>
              <FilterPanel
                filters={filters}
                onChange={updateFilters}
                onReset={resetFilters}
                categories={categories}
                hasGeo={!!geo}
              />
            </SheetContent>
          </Sheet>

          <Select value={sort} onValueChange={handleSort}>
            <SelectTrigger className="h-9 w-[170px]" aria-label="Эрэмбэлэх">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem
                  key={o.value}
                  value={o.value}
                  disabled={o.value === "nearest" && !geo}
                >
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {isFetching && items.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <BusinessCardSkeleton key={i} layout="row" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Одоогоор илэрц олдсонгүй"
          description="Шүүлтүүрээ өөрчлөөд дахин хайж үзнэ үү."
          action={{ label: "Шүүлтүүр цэвэрлэх", onClick: resetFilters }}
        />
      ) : (
        <div
          className={cn(
            "space-y-3 transition-opacity",
            isFetching && "opacity-60",
          )}
        >
          {items.map((b) => (
            <div
              key={b.id}
              onMouseEnter={() => setHighlightId(b.id)}
              onMouseLeave={() => setHighlightId(null)}
            >
              <BusinessCard business={b} layout="row" />
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > (result?.pageSize ?? PAGE_SIZE) && (
        <Pagination
          className="mt-8"
          page={page}
          total={total}
          pageSize={result?.pageSize ?? PAGE_SIZE}
          buildHref={(p) =>
            `/search?${buildParams({ query, filters, sort, page: p, geo }).toString()}`
          }
        />
      )}
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
      {/* Desktop filter rail */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
          <FilterPanel
            filters={filters}
            onChange={updateFilters}
            onReset={resetFilters}
            categories={categories}
            hasGeo={!!geo}
          />
        </div>
      </aside>

      {/* List + map split */}
      <div className="min-w-0">
        <MapListSplit
          pins={mapPins}
          center={geo ? { lng: geo.lng, lat: geo.lat } : undefined}
          onBoundsChange={handleBounds}
          highlightId={highlightId}
          onPinClick={(pin) => {
            window.location.href = `/business/${pin.slug}`;
          }}
        >
          {list}
        </MapListSplit>
      </div>

      {isFetching && (
        <div className="pointer-events-none fixed bottom-24 right-4 z-30 lg:bottom-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-float">
            <Loader2 className="size-3.5 animate-spin" />
            Шинэчилж байна
          </span>
        </div>
      )}
    </div>
  );
}
