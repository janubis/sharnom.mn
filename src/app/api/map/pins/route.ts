/**
 * GET /api/map/pins — businesses inside a map viewport as MapPins.
 *
 * Validates the bounds + optional filters, delegates to getMapPins (which caps
 * the result at MAP_MAX_PINS), and returns { pins }.
 */
import "server-only";

import type { NextRequest } from "next/server";

import { handleError, ok, searchParamsToObject } from "@/lib/api";
import { getMapPins } from "@/db/queries/map";
import { mapBoundsSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const raw = searchParamsToObject(req.url);
    const bounds = mapBoundsSchema.parse(raw);

    const minRating = raw.minRating ? Number(raw.minRating) : undefined;

    const pins = await getMapPins({
      bounds,
      categorySlug: raw.category || undefined,
      district: raw.district || undefined,
      minRating: Number.isFinite(minRating) ? minRating : undefined,
      openNow: raw.openNow === "true" || raw.openNow === "1",
      verifiedOnly: raw.verified === "true" || raw.verified === "1",
    });

    return ok({ pins });
  } catch (e) {
    return handleError(e);
  }
}
