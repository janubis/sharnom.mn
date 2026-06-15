/**
 * Map pin source. Reuses the search engine (with map bounds + filters) and
 * projects SearchItem → MapPin, capped at MAP_MAX_PINS. Backs /api/map/pins.
 */
import "server-only";

import { MAP_MAX_PINS } from "@/lib/constants";
import type { MapBounds, MapPin } from "@/lib/maps/provider";
import { searchBusinesses } from "@/lib/search";
import type { SortOption } from "@/lib/constants";

export type MapPinsParams = {
  bounds: MapBounds;
  categorySlug?: string;
  district?: string;
  minRating?: number;
  openNow?: boolean;
  verifiedOnly?: boolean;
  /** Optional centre for proximity-biased ranking inside the viewport. */
  lat?: number;
  lng?: number;
};

/**
 * Businesses inside a viewport as map pins. Ranking favours the most relevant
 * (recommended) so that, when a viewport holds more than MAP_MAX_PINS results,
 * the most useful ones survive the cap.
 */
export async function getMapPins(params: MapPinsParams): Promise<MapPin[]> {
  const hasGeo = params.lat != null && params.lng != null;
  const sort: SortOption = hasGeo ? "nearest" : "recommended";

  const result = await searchBusinesses({
    bounds: params.bounds,
    categorySlug: params.categorySlug,
    district: params.district,
    minRating: params.minRating,
    openNow: params.openNow,
    verifiedOnly: params.verifiedOnly,
    lat: params.lat,
    lng: params.lng,
    sort,
    page: 1,
    pageSize: MAP_MAX_PINS,
  });

  const pins: MapPin[] = [];
  for (const item of result.items) {
    if (item.lat == null || item.lng == null) continue;
    pins.push({
      id: item.id,
      slug: item.slug,
      name: item.name,
      lat: item.lat,
      lng: item.lng,
      rating: item.ratingAvg,
      reviewCount: item.reviewCount,
      categoryIcon: item.category?.icon ?? undefined,
      verified: item.verified,
      priceLevel: item.priceLevel,
    });
    if (pins.length >= MAP_MAX_PINS) break;
  }

  return pins;
}
