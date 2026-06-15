/**
 * Owner photo management for a business: attach, set-cover, delete.
 *
 *  - POST   { keys: string[], captions?: string[] } → insert PENDING rows and
 *           return the created photo objects so the client can render them.
 *  - PATCH  { photoId, isCover: true }              → make a photo the cover
 *           (clears the flag on every other photo of the business).
 *  - DELETE ?photoId=…                              → remove a photo.
 *
 * Every verb verifies the signed-in OWNER actually owns the business and that
 * the target photo belongs to it, then recomputes profile aggregates and writes
 * an audit-log entry. Lives under /api/owner so it is fully gated to OWNER+.
 */
import "server-only";

import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { businessPhotos } from "@/db/schema";
import { fail, getClientIp, handleError, ok } from "@/lib/api";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { requireRole } from "@/lib/rbac";
import { recomputeBusinessAggregates, userOwnsBusiness } from "@/db/queries/businesses";
import { auditLog } from "@/db/queries/users";
import { publicUrlFor } from "@/lib/storage/s3";
import { trackAsync } from "@/lib/analytics/track";
import { idSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const attachSchema = z.object({
  keys: z.array(z.string().min(1).max(300)).min(1).max(12),
  captions: z.array(z.string().max(200)).optional(),
});

const coverSchema = z.object({
  photoId: idSchema,
  isCover: z.literal(true),
});

type Params = { params: Promise<{ id: string }> };

/** Resolve the business id from the path and assert OWNER ownership. */
async function authorize(params: Params["params"]) {
  const { id } = await params;
  const businessId = idSchema.parse(id);
  const user = await requireRole("OWNER");
  const owns = await userOwnsBusiness(user.id, businessId);
  if (!owns) return { error: fail("Энэ бизнес танд харьяалагдахгүй байна", 403) };
  return { businessId, user };
}

/* ── Attach newly uploaded photos ──────────────────────────────────────────── */
export async function POST(req: Request, { params }: Params) {
  try {
    const authz = await authorize(params);
    if ("error" in authz) return authz.error;
    const { businessId, user } = authz;

    const ip = await getClientIp();
    const limit = await rateLimit(
      rateLimitKey("photoUpload", user.id ?? ip),
      RATE_LIMITS.photoUpload,
    );
    if (!limit.success) return fail("Хэт олон хүсэлт. Түр хүлээнэ үү.", 429);

    const body = await req.json();
    const { keys, captions } = attachSchema.parse(body);

    const inserted = await db
      .insert(businessPhotos)
      .values(
        keys.map((key, i) => ({
          businessId,
          uploadedByUserId: user.id,
          imageUrl: publicUrlFor(key),
          caption: captions?.[i] ?? null,
          status: "PENDING" as const,
        })),
      )
      .returning({
        id: businessPhotos.id,
        imageUrl: businessPhotos.imageUrl,
        caption: businessPhotos.caption,
        isCover: businessPhotos.isCover,
        status: businessPhotos.status,
      });

    trackAsync({
      event: "photo_uploaded",
      businessId,
      userId: user.id,
      metadata: { count: inserted.length },
    });
    await auditLog(user.id, "owner.business.photo.add", "business", businessId, undefined, {
      count: inserted.length,
    }, ip);

    return ok({ photos: inserted }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

/* ── Set a photo as the cover ──────────────────────────────────────────────── */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const authz = await authorize(params);
    if ("error" in authz) return authz.error;
    const { businessId, user } = authz;

    const body = await req.json();
    const { photoId } = coverSchema.parse(body);

    const photo = await db.query.businessPhotos.findFirst({
      where: and(eq(businessPhotos.id, photoId), eq(businessPhotos.businessId, businessId)),
      columns: { id: true },
    });
    if (!photo) return fail("Зураг олдсонгүй", 404);

    await db.transaction(async (tx) => {
      await tx
        .update(businessPhotos)
        .set({ isCover: false })
        .where(and(eq(businessPhotos.businessId, businessId), ne(businessPhotos.id, photoId)));
      await tx
        .update(businessPhotos)
        .set({ isCover: true })
        .where(eq(businessPhotos.id, photoId));
    });

    const ip = await getClientIp();
    await auditLog(user.id, "owner.business.photo.cover", "business", businessId, undefined, {
      photoId,
    }, ip);

    return ok({ photoId, isCover: true });
  } catch (e) {
    return handleError(e);
  }
}

/* ── Delete a photo ────────────────────────────────────────────────────────── */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const authz = await authorize(params);
    if ("error" in authz) return authz.error;
    const { businessId, user } = authz;

    const photoId = idSchema.parse(new URL(req.url).searchParams.get("photoId"));

    const deleted = await db
      .delete(businessPhotos)
      .where(and(eq(businessPhotos.id, photoId), eq(businessPhotos.businessId, businessId)))
      .returning({ id: businessPhotos.id });

    if (deleted.length === 0) return fail("Зураг олдсонгүй", 404);

    // Photo count contributes to completeness — keep aggregates fresh.
    await recomputeBusinessAggregates(businessId);

    const ip = await getClientIp();
    await auditLog(user.id, "owner.business.photo.delete", "business", businessId, undefined, {
      photoId,
    }, ip);

    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
