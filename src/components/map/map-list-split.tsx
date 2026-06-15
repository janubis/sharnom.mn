"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { List, Map as MapIcon, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MapPin, MapBounds, LngLat } from "@/lib/maps/provider";
import { Button } from "@/components/ui/button";

// Lazy-load the map so the GL bundle is never part of SSR / first paint.
const MapView = dynamic(
  () => import("@/components/map/map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="shimmer flex h-full w-full items-center justify-center rounded-2xl bg-muted">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

export type MapListSplitProps = {
  /** The result list (cards). */
  children: React.ReactNode;
  pins: MapPin[];
  center?: LngLat;
  zoom?: number;
  onBoundsChange?: (bounds: MapBounds, zoom: number) => void;
  onPinClick?: (pin: MapPin) => void;
  highlightId?: string | null;
  className?: string;
};

/**
 * Responsive split view: list on the left, a sticky map on the right at
 * desktop widths. On mobile it collapses to a single column with a floating
 * "Газрын зураг / Жагсаалт" toggle that swaps between full-screen views.
 */
export function MapListSplit({
  children,
  pins,
  center,
  zoom,
  onBoundsChange,
  onPinClick,
  highlightId,
  className,
}: MapListSplitProps) {
  const [mobileView, setMobileView] = React.useState<"list" | "map">("list");

  return (
    <div className={cn("relative", className)}>
      {/* Desktop split */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,46%)] lg:gap-6">
        {/* List column */}
        <div
          className={cn(
            "min-w-0",
            mobileView === "map" ? "hidden lg:block" : "block",
          )}
        >
          {children}
        </div>

        {/* Map column — sticky on desktop, full-bleed sheet on mobile */}
        <div
          className={cn(
            mobileView === "list" ? "hidden lg:block" : "block",
            "lg:sticky lg:top-20 lg:self-start",
          )}
        >
          <div
            className={cn(
              "overflow-hidden rounded-2xl border border-border shadow-card",
              "fixed inset-x-0 bottom-0 top-32 z-30 rounded-none lg:static lg:h-[calc(100vh-7rem)] lg:rounded-2xl",
            )}
          >
            <MapView
              pins={pins}
              center={center}
              zoom={zoom}
              onBoundsChange={onBoundsChange}
              onPinClick={onPinClick}
              highlightId={highlightId}
              height="100%"
              className="h-full rounded-none lg:rounded-2xl"
            />
          </div>
        </div>
      </div>

      {/* Mobile toggle */}
      <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 lg:hidden">
        <Button
          type="button"
          onClick={() => setMobileView((v) => (v === "list" ? "map" : "list"))}
          className="rounded-full shadow-float"
        >
          {mobileView === "list" ? (
            <>
              <MapIcon className="size-4" />
              Газрын зураг
            </>
          ) : (
            <>
              <List className="size-4" />
              Жагсаалт
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
