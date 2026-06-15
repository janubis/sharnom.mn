import type { MapBounds } from "@/lib/maps/provider";
import type { SortOption } from "@/lib/constants";

export type SearchParams = {
  q?: string;
  categorySlug?: string;
  district?: string;
  minRating?: number;
  priceLevels?: number[];
  openNow?: boolean;
  verifiedOnly?: boolean;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
  /** When set, restricts results to a map viewport (used by the pins API). */
  bounds?: MapBounds;
};

export type SearchItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  ratingAvg: number;
  reviewCount: number;
  priceLevel: number | null;
  verified: boolean;
  category: { nameMn: string; slug: string; icon: string | null } | null;
  district: string | null;
  addressText: string | null;
  lat: number | null;
  lng: number | null;
  coverPhotoUrl: string | null;
  phone: string | null;
  distanceMeters: number | null;
};

export type SearchResult = {
  items: SearchItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};
