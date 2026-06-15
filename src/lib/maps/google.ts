/**
 * Google Maps adapter — PLACEHOLDER.
 *
 * Intentionally a stub so the provider abstraction is proven on day one.
 * To enable: implement create() with @googlemaps/js-api-loader + MarkerClusterer,
 * mapping the same MapInstance surface, then set NEXT_PUBLIC_MAP_PROVIDER=google.
 *
 * Keeping the contract identical means UI components never change.
 */
import type { MapInitOptions, MapInstance, MapProvider } from "./provider";

export const googleProvider: MapProvider = {
  name: "google",
  async create(_options: MapInitOptions): Promise<MapInstance> {
    throw new Error(
      "Google Maps adapter is not implemented yet. " +
        "Set NEXT_PUBLIC_MAP_PROVIDER=maplibre, or implement google.ts using " +
        "@googlemaps/js-api-loader + @googlemaps/markerclusterer.",
    );
  },
};
