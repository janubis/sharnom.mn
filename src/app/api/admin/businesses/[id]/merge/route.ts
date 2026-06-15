/**
 * POST /api/admin/businesses/[id]/merge — merge a duplicate into this (primary)
 * business. ADMIN+. Body: { duplicateId }.
 */
import "server-only";

import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { businesses } from "@/db/schema";
import { auditLog } from "@/db/queries/users";
import { mergeBusinesses } from "@/db/queries/businesses";
import { ok, fail, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { idSchema } from "@/lib/validations";
import { invalidate, cacheKeys } from "@/lib/redis";
import { actorContext } from "../../../_lib";

export const dynamic = "force-dynamic";

const mergeSchema = z.object({ duplicateId: idSchema });

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requireRole("ADMIN");
    const primaryId = idSchema.parse((await params).id);
    const { duplicateId } = mergeSchema.parse(await req.json());

    if (primaryId === duplicateId) {
      return fail("Бизнесийг өөртэй нь нэгтгэх боломжгүй", 422);
    }

    const [primary, duplicate] = await Promise.all([
      db.query.businesses.findFirst({
        where: eq(businesses.id, primaryId),
        columns: { id: true, slug: true },
      }),
      db.query.businesses.findFirst({
        where: eq(businesses.id, duplicateId),
        columns: { id: true, slug: true },
      }),
    ]);
    if (!primary || !duplicate) return fail("Бизнес олдсонгүй", 404);

    const { merged } = await mergeBusinesses(primaryId, duplicateId);
    if (!merged) return fail("Нэгтгэх боломжгүй байна", 409);

    const { actorId, ip } = await actorContext(actor);
    await auditLog(
      actorId,
      "business.merge",
      "business",
      primaryId,
      { duplicateId },
      { primaryId },
      ip,
    );
    await invalidate(
      cacheKeys.business(primary.slug),
      cacheKeys.business(duplicate.slug),
      cacheKeys.homeFeed(),
    );

    return ok({ merged: true, primaryId, duplicateId });
  } catch (e) {
    return handleError(e);
  }
}
