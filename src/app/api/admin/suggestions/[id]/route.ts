/**
 * PATCH /api/admin/suggestions/[id] — approve or reject an edit suggestion.
 * MODERATOR+. Body: { decision: "APPROVED" | "REJECTED" }.
 */
import "server-only";

import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { businesses } from "@/db/schema";
import { auditLog } from "@/db/queries/users";
import { decideSuggestion, SuggestionError } from "@/db/queries/suggestions";
import { recomputeBusinessAggregates } from "@/db/queries/businesses";
import { ok, fail, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { idSchema } from "@/lib/validations";
import { invalidate, cacheKeys } from "@/lib/redis";
import { actorContext } from "../../_lib";

export const dynamic = "force-dynamic";

const decideSchema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]) });

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requireRole("MODERATOR");
    const id = idSchema.parse((await params).id);
    const { decision } = decideSchema.parse(await req.json());

    const { suggestion, applied } = await decideSuggestion(id, actor.id ?? "", decision);

    if (applied) {
      // Applied edits may change name/contact/location — refresh completeness + cache.
      await recomputeBusinessAggregates(suggestion.businessId);
      const biz = await db.query.businesses.findFirst({
        where: eq(businesses.id, suggestion.businessId),
        columns: { slug: true },
      });
      if (biz?.slug) await invalidate(cacheKeys.business(biz.slug), cacheKeys.homeFeed());
    }

    const { actorId, ip } = await actorContext(actor);
    await auditLog(
      actorId,
      `suggestion.${decision.toLowerCase()}`,
      "suggestion",
      id,
      null,
      { decision, applied },
      ip,
    );

    return ok({ suggestion, applied });
  } catch (e) {
    if (e instanceof SuggestionError) return fail(e.message, e.status);
    return handleError(e);
  }
}
