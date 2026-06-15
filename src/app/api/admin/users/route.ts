/**
 * GET /api/admin/users — paginated, filtered user table. MODERATOR+.
 */
import "server-only";

import { NextRequest } from "next/server";

import { listUsersForAdmin } from "@/db/queries/users";
import { ok, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import type { UserRole } from "@/db/schema";
import { intParam } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireRole("MODERATOR");

    const sp = req.nextUrl.searchParams;
    const page = intParam(sp.get("page"), 1);
    const pageSize = intParam(sp.get("pageSize"), 20);

    const { items, total } = await listUsersForAdmin({
      q: sp.get("q") ?? undefined,
      role: (sp.get("role") as UserRole) ?? undefined,
      page,
      pageSize,
    });

    return ok({
      items,
      total,
      page,
      pageSize,
      hasMore: (page - 1) * pageSize + items.length < total,
    });
  } catch (e) {
    return handleError(e);
  }
}
