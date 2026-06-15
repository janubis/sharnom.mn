/**
 * GET /api/districts — all UB districts with ACTIVE business counts (1h cache).
 */
import "server-only";

import { handleError, ok } from "@/lib/api";
import { listDistricts } from "@/db/queries/districts";

export const revalidate = 3600;

export async function GET() {
  try {
    const districts = await listDistricts();
    return ok(districts);
  } catch (e) {
    return handleError(e);
  }
}
