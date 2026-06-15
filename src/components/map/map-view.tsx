"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { clientConfig } from "@/lib/env";
import { getMapProvider } from "@/lib/maps";
import { UB_CENTER } from "@/lib/constants";
import type {
  MapInstance,
  MapPin,
  MapBounds,
  LngLat,
} from "@/lib/maps/provider";

export type MapViewProps = {
  pins?: MapPin[];
  center?: LngLat;
  zoom?: number;
  /** Fired (debounced by the provider) when the viewport settles. */
  onBoundsChange?: (bounds: MapBounds, zoom: number) => void;
  /** Fired when a pin is clicked. */
  onPinClick?: (pin: MapPin) => void;
  /** Pin id to visually highlight (e.g. hovered list card). */
  highlightId?: string | null;
  /** CSS height; number → px. Defaults to 100% of the container. */
  height?: number | string;
  className?: string;
};

/**
 * Provider-agnostic map. The concrete map (MapLibre/Google) is created lazily
 * inside an effect via getMapProvider().create() so the heavy GL bundle stays
 * out of SSR and the initial payload. A shimmer skeleton shows until ready.
 *
 * Note: this component is registered with next/dynamic({ ssr: false }) by
 * callers, but the effect-only creation also makes direct import safe.
 */
export function MapView({
  pins = [],
  center,
  zoom,
  onBoundsChange,
  onPinClick,
  highlightId = null,
  height = "100%",
  className,
}: MapViewProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MapInstance | null>(null);
  const [ready, setReady] = React.useState(false);

  // Keep latest callbacks without re-creating the map.
  const boundsCb = React.useRef(onBoundsChange);
  const pinCb = React.useRef(onPinClick);
  React.useEffect(() => {
    boundsCb.current = onBoundsChange;
    pinCb.current = onPinClick;
  });

  // Create once on mount; destroy on unmount.
  React.useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;

    const provider = getMapProvider();
    provider
      .create({
        container: el,
        center: center ?? {
          lng: clientConfig.NEXT_PUBLIC_MAP_DEFAULT_LNG ?? UB_CENTER.lng,
          lat: clientConfig.NEXT_PUBLIC_MAP_DEFAULT_LAT ?? UB_CENTER.lat,
        },
        zoom: zoom ?? clientConfig.NEXT_PUBLIC_MAP_DEFAULT_ZOOM ?? 12,
        styleUrl: clientConfig.NEXT_PUBLIC_MAP_STYLE_URL,
        onBoundsChange: (b, z) => boundsCb.current?.(b, z),
        onPinClick: (p) => pinCb.current?.(p),
      })
      .then((instance) => {
        if (cancelled) {
          instance.destroy();
          return;
        }
        mapRef.current = instance;
        setReady(true);
      })
      .catch((err) => {
        console.error("Map init failed", err);
      });

    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
    // Intentionally create-once: center/zoom changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync pins.
  React.useEffect(() => {
    if (!ready) return;
    mapRef.current?.setPins(pins);
  }, [pins, ready]);

  // Sync highlight.
  React.useEffect(() => {
    if (!ready) return;
    mapRef.current?.highlightPin(highlightId);
  }, [highlightId, ready]);

  // Recenter when center prop changes (after init).
  React.useEffect(() => {
    if (!ready || !center) return;
    mapRef.current?.flyTo(center, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, ready]);

  const style: React.CSSProperties = {
    height: typeof height === "number" ? `${height}px` : height,
  };

  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl bg-muted", className)}
      style={style}
    >
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {!ready && (
        <div className="shimmer absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span className="sr-only">Газрын зураг ачааллаж байна</span>
        </div>
      )}
    </div>
  );
}

export default MapView;
