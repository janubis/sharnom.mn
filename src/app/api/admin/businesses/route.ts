/**
 * /api/admin/businesses
 *   GET  — paginated, filtered admin table (MODERATOR+)
 *   POST — create a business (ADMIN+)
 */
import "server-only";

import { NextRequest } from "next/server";

import { auditLog } from "@/db/queries/users";
import {
  listBusinessesForAdmin,
  recomputeBusinessAggregates,
} from "@/db/queries/businesses";
import { ok, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { upsertBusinessSchema } from "@/lib/validations";
import { invalidate, cacheKeys } from "@/lib/redis";
import type { Business } from "@/db/schema";
import { actorContext, createBusinessAdmin, intParam } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireRole("MODERATOR");

    const sp = req.nextUrl.searchParams;
    const page = intParam(sp.get("page"), 1);
    const pageSize = intParam(sp.get("pageSize"), 20);

    const { items, total } = await listBusinessesForAdmin({
      q: sp.get("q") ?? undefined,
      category: sp.get("category") ?? undefined,
      verification:
        (sp.get("verification") as Business["verificationStatus"]) ?? undefined,
      status: (sp.get("status") as Business["status"]) ?? undefined,
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

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN");
    const input = upsertBusinessSchema.parse(await req.json());

    const biz = await createBusinessAdmin(input);
    await recomputeBusinessAggregates(biz.id);

    const { actorId, ip } = await actorContext(actor);
    await auditLog(actorId, "business.create", "business", biz.id, null, biz, ip);
    await invalidate(cacheKeys.business(biz.slug), cacheKeys.homeFeed());

    return ok({ business: biz }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
