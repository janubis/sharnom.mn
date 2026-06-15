/**
 * GET /api/owner/businesses — businesses owned by the current OWNER.
 */
import "server-only";

import { handleError, ok } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { listOwnerBusinesses } from "@/db/queries/owner";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("OWNER");
    const items = await listOwnerBusinesses(user.id);
    return ok(items);
  } catch (e) {
    return handleError(e);
  }
}
