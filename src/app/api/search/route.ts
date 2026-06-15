/**
 * GET /api/search — business discovery.
 *
 * Parses & validates query params, maps them to the engine's SearchParams,
 * runs the search dispatcher and returns a SearchResult. Logs the query on the
 * side (fire-and-forget) without blocking the response.
 */
import "server-only";

import type { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { handleError, ok, searchParamsToObject } from "@/lib/api";
import { trackSearch } from "@/lib/analytics/track";
import { searchBusinesses } from "@/lib/search";
import type { SearchParams } from "@/lib/search/types";
import { searchParamsSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const raw = searchParamsToObject(req.url);
    const input = searchParamsSchema.parse(raw);

    const params: SearchParams = {
      q: input.q,
      categorySlug: input.category,
      district: input.district,
      minRating: input.minRating,
      priceLevels: input.price,
      openNow: input.openNow,
      verifiedOnly: input.verified,
      lat: input.lat,
      lng: input.lng,
      radiusKm: input.radius,
      sort: input.sort,
      page: input.page,
      pageSize: input.pageSize,
    };

    const result = await searchBusinesses(params);

    if (input.q && input.q.trim()) {
      const user = await getCurrentUser();
      void trackSearch(input.q, result.total, user?.id ?? null);
    }

    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
