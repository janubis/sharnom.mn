/**
 * GET /api/admin/analytics?range=7d|30d|90d|1y — traffic & engagement series.
 * MODERATOR and above.
 */
import "server-only";

import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import {
  getTrafficSeries,
  getTopCategories,
  getTopDistricts,
  getMostViewedBusinesses,
  getMostReviewedBusinesses,
  getMapInteractionSeries,
} from "@/db/queries/admin-stats";
import { rangeToDays } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireRole("MODERATOR");

    const range = req.nextUrl.searchParams.get("range");
    const days = rangeToDays(range);

    const [
      traffic,
      topCategories,
      topDistricts,
      mostViewed,
      mostReviewed,
      mapInteractions,
    ] = await Promise.all([
      getTrafficSeries(days),
      getTopCategories(10),
      getTopDistricts(10),
      getMostViewedBusinesses(10),
      getMostReviewedBusinesses(10),
      getMapInteractionSeries(days),
    ]);

    return ok({
      range: range ?? "30d",
      days,
      traffic,
      topCategories,
      topDistricts,
      mostViewed,
      mostReviewed,
      mapInteractions,
    });
  } catch (e) {
    return handleError(e);
  }
}
