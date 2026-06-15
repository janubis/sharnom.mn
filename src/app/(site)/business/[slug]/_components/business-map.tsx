"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import type { MapPin } from "@/lib/maps/provider";

// Keep the GL bundle out of SSR and the initial payload.
const MapView = dynamic(
  () => import("@/components/map/map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="shimmer h-72 w-full rounded-2xl bg-muted" aria-hidden />
    ),
  },
);

export type BusinessMapProps = {
  pin: MapPin;
  height?: number | string;
};

/** Single-pin location map for the business detail page. */
export function BusinessMap({ pin, height = 288 }: BusinessMapProps) {
  const pins = React.useMemo(() => [pin], [pin]);
  return (
    <MapView
      pins={pins}
      center={{ lng: pin.lng, lat: pin.lat }}
      zoom={15}
      height={height}
    />
  );
}
