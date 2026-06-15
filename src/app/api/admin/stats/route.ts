/**
 * GET /api/admin/stats — headline KPIs + active users + top searches.
 * MODERATOR and above.
 */
import "server-only";

import { ok, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import {
  getAdminKpis,
  getActiveUsers,
  getTopSearches,
} from "@/db/queries/admin-stats";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("MODERATOR");

    const [kpis, activeUsers, topSearches] = await Promise.all([
      getAdminKpis(),
      getActiveUsers(),
      getTopSearches(10, 30),
    ]);

    return ok({ kpis, activeUsers, topSearches });
  } catch (e) {
    return handleError(e);
  }
}
