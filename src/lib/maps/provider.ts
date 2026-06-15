/**
 * Map provider abstraction.
 *
 * The app renders maps through a `MapProvider` so we can swap MapLibre GL JS
 * (default, self-hosted vector tiles) for Google Maps later without touching
 * UI components. Implementations live in ./maplibre and ./google.
 */

export type LngLat = { lng: number; lat: number };

export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type MapPin = {
  id: string;
  slug: string;
  name: string;
  lng: number;
  lat: number;
  rating?: number;
  reviewCount?: number;
  categoryIcon?: string;
  verified?: boolean;
  priceLevel?: number | null;
};

export type MapInitOptions = {
  container: HTMLElement;
  center: LngLat;
  zoom: number;
  styleUrl: string;
  /** Fired (debounced) whenever the visible bounds settle. */
  onBoundsChange?: (bounds: MapBounds, zoom: number) => void;
  /** Fired when a clustered/individual pin is clicked. */
  onPinClick?: (pin: MapPin) => void;
};

/**
 * A concrete map instance. Returned by MapProvider.create().
 * Keeps the surface minimal so adapters are easy to implement.
 */
export interface MapInstance {
  setPins(pins: MapPin[]): void;
  flyTo(center: LngLat, zoom?: number): void;
  fitBounds(bounds: MapBounds, padding?: number): void;
  getBounds(): MapBounds;
  highlightPin(id: string | null): void;
  resize(): void;
  destroy(): void;
}

export interface MapProvider {
  readonly name: "maplibre" | "google";
  /** Lazily create a map bound to a DOM container. */
  create(options: MapInitOptions): Promise<MapInstance>;
}

export type MapProviderName = MapProvider["name"];
