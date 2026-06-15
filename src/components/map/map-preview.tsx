"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MapPin, LngLat } from "@/lib/maps/provider";

// Lazy-load the GL map so it stays out of SSR / first paint.
const MapView = dynamic(
  () => import("@/components/map/map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="shimmer flex h-full w-full items-center justify-center bg-muted">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

export type MapPreviewProps = {
  pins: MapPin[];
  center?: LngLat;
  zoom?: number;
  height?: number | string;
  className?: string;
};

/**
 * A non-interactive-feeling map preview for landing pages (category/district):
 * shows the pins for the section. Clicking a pin navigates to that business.
 */
export function MapPreview({
  pins,
  center,
  zoom = 12,
  height = 320,
  className,
}: MapPreviewProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border shadow-card",
        className,
      )}
    >
      <MapView
        pins={pins}
        center={center}
        zoom={zoom}
        height={height}
        onPinClick={(pin) => {
          window.location.href = `/business/${pin.slug}`;
        }}
      />
    </div>
  );
}
