/**
 * GET /api/admin/reviews — moderation queue. Filter by ?status= and ?reported=.
 * MODERATOR+.
 */
import "server-only";

import { NextRequest } from "next/server";

import { listReviewsForAdmin } from "@/db/queries/reviews";
import { ok, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import type { ReviewStatus } from "@/db/schema";
import { intParam } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireRole("MODERATOR");

    const sp = req.nextUrl.searchParams;
    const page = intParam(sp.get("page"), 1);
    const pageSize = intParam(sp.get("pageSize"), 20);

    const { items, total } = await listReviewsForAdmin({
      status: (sp.get("status") as ReviewStatus) ?? undefined,
      reported: sp.get("reported") === "true" ? true : undefined,
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
