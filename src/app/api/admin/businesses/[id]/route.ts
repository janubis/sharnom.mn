/**
 * /api/admin/businesses/[id]
 *   GET    — full business detail by id (MODERATOR+)
 *   PUT    — update (ADMIN+, upsertBusinessSchema)
 *   DELETE — soft-delete (ADMIN+)
 */
import "server-only";

import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { businesses } from "@/db/schema";
import { auditLog } from "@/db/queries/users";
import { recomputeBusinessAggregates } from "@/db/queries/businesses";
import { ok, fail, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { idSchema, upsertBusinessSchema } from "@/lib/validations";
import { invalidate, cacheKeys } from "@/lib/redis";
import {
  actorContext,
  softDeleteBusiness,
  updateBusinessAdmin,
} from "../../_lib";

export const dynamic = "force-dynamic";

// Admins may also flip lifecycle/verification state alongside content edits.
const adminPutSchema = upsertBusinessSchema.partial().extend({
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "DUPLICATE", "DELETED"]).optional(),
  verificationStatus: z.enum(["UNVERIFIED", "CLAIMED", "VERIFIED"]).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requireRole("MODERATOR");
    const id = idSchema.parse((await params).id);

    const business = await db.query.businesses.findFirst({
      where: eq(businesses.id, id),
      with: {
        location: true,
        contact: true,
        hours: true,
        primaryCategory: true,
        owner: { columns: { id: true, name: true, email: true, image: true } },
      },
    });
    if (!business) return fail("Бизнес олдсонгүй", 404);

    return ok({ business });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requireRole("ADMIN");
    const id = idSchema.parse((await params).id);
    const { status, verificationStatus, ...content } = adminPutSchema.parse(
      await req.json(),
    );

    const before = await db.query.businesses.findFirst({
      where: eq(businesses.id, id),
    });
    const updated = await updateBusinessAdmin(id, content);
    if (!updated) return fail("Бизнес олдсонгүй", 404);

    // Lifecycle / verification changes aren't part of upsertBusinessSchema.
    let result = updated;
    if (status || verificationStatus) {
      const [bumped] = await db
        .update(businesses)
        .set({
          ...(status ? { status } : {}),
          ...(verificationStatus ? { verificationStatus } : {}),
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, id))
        .returning();
      if (bumped) result = bumped;
    }

    await recomputeBusinessAggregates(id);

    const { actorId, ip } = await actorContext(actor);
    await auditLog(actorId, "business.update", "business", id, before, result, ip);
    await invalidate(
      cacheKeys.business(result.slug),
      ...(before && before.slug !== result.slug ? [cacheKeys.business(before.slug)] : []),
      cacheKeys.homeFeed(),
    );

    return ok({ business: result });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requireRole("ADMIN");
    const id = idSchema.parse((await params).id);

    const before = await db.query.businesses.findFirst({
      where: eq(businesses.id, id),
      columns: { id: true, slug: true, status: true, name: true },
    });
    const deleted = await softDeleteBusiness(id);
    if (!deleted) return fail("Бизнес олдсонгүй эсвэл аль хэдийн устгагдсан байна", 404);

    const { actorId, ip } = await actorContext(actor);
    await auditLog(actorId, "business.delete", "business", id, before, null, ip);
    if (before?.slug) await invalidate(cacheKeys.business(before.slug), cacheKeys.homeFeed());

    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
