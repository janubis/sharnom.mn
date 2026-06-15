/**
 * GET /api/admin/suggestions — community edit-suggestion queue. Filter by
 * ?status=. MODERATOR+.
 */
import "server-only";

import { NextRequest } from "next/server";

import { listSuggestionsForAdmin } from "@/db/queries/suggestions";
import { ok, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import type { SuggestionStatus } from "@/db/queries/suggestions";
import { intParam } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireRole("MODERATOR");

    const sp = req.nextUrl.searchParams;
    const page = intParam(sp.get("page"), 1);
    const pageSize = intParam(sp.get("pageSize"), 20);

    const { items, total } = await listSuggestionsForAdmin({
      status: (sp.get("status") as SuggestionStatus) ?? undefined,
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
