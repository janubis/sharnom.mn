/**
 * PATCH /api/admin/photos/[id]?type=business|review — approve or reject a photo.
 * MODERATOR+. Body: { status: "APPROVED" | "REJECTED" }.
 */
import "server-only";

import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { businessPhotos, reviewPhotos } from "@/db/schema";
import { auditLog } from "@/db/queries/users";
import { recomputeBusinessAggregates } from "@/db/queries/businesses";
import { ok, fail, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { idSchema } from "@/lib/validations";
import { invalidate, cacheKeys } from "@/lib/redis";
import { businesses } from "@/db/schema";
import { actorContext } from "../../_lib";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requireRole("MODERATOR");
    const id = idSchema.parse((await params).id);
    const type = req.nextUrl.searchParams.get("type") === "review" ? "review" : "business";
    const { status } = patchSchema.parse(await req.json());

    let businessId: string | null = null;
    if (type === "review") {
      const existing = await db.query.reviewPhotos.findFirst({
        where: eq(reviewPhotos.id, id),
        columns: { id: true, businessId: true, status: true },
      });
      if (!existing) return fail("Зураг олдсонгүй", 404);
      await db
        .update(reviewPhotos)
        .set({ status })
        .where(eq(reviewPhotos.id, id));
      businessId = existing.businessId;
    } else {
      const existing = await db.query.businessPhotos.findFirst({
        where: eq(businessPhotos.id, id),
        columns: { id: true, businessId: true, status: true },
      });
      if (!existing) return fail("Зураг олдсонгүй", 404);
      await db
        .update(businessPhotos)
        .set({ status })
        .where(eq(businessPhotos.id, id));
      businessId = existing.businessId;
    }

    if (businessId) {
      // Keep photo_count / completeness in sync after approve/reject.
      await recomputeBusinessAggregates(businessId);
      const biz = await db.query.businesses.findFirst({
        where: eq(businesses.id, businessId),
        columns: { slug: true },
      });
      if (biz?.slug) await invalidate(cacheKeys.business(biz.slug));
    }

    const { actorId, ip } = await actorContext(actor);
    await auditLog(actorId, `photo.${status.toLowerCase()}`, `${type}_photo`, id, null, { status }, ip);

    return ok({ id, type, status });
  } catch (e) {
    return handleError(e);
  }
}
