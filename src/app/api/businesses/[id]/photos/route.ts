/**
 * /api/businesses/:id/photos
 *   POST   — attach uploaded photos to a business (owner/moderator → APPROVED,
 *            community uploads → PENDING for moderation).
 *   PATCH  — set a photo as the cover ({ photoId, isCover:true }).
 *   DELETE — remove a photo (?photoId=...).
 *
 * Keys are object-storage keys from a prior presigned upload; we resolve them
 * to public URLs. Mutations require business ownership or MODERATOR+.
 */
import "server-only";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { businessPhotos, businesses } from "@/db/schema";
import { fail, getClientIp, handleError, ok } from "@/lib/api";
import { trackAsync } from "@/lib/analytics/track";
import { recomputeBusinessAggregates } from "@/db/queries/businesses";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { AuthError, hasRole, requireUser } from "@/lib/rbac";
import { publicUrlFor } from "@/lib/storage/s3";
import { idSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  keys: z.array(z.string().min(1).max(300)).min(1).max(12),
  captions: z.array(z.string().max(200)).optional(),
});

const patchSchema = z.object({
  photoId: idSchema,
  isCover: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

/** Load the business and whether the user may manage its photos. */
async function loadBusiness(businessId: string) {
  return db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: { id: true, ownerUserId: true },
  });
}

function canManage(
  biz: { ownerUserId: string | null },
  user: { id: string; role: "USER" | "OWNER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN" },
) {
  return biz.ownerUserId === user.id || hasRole(user.role, "MODERATOR");
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const businessId = idSchema.parse(id);
    const user = await requireUser();

    const ip = await getClientIp();
    const limit = await rateLimit(
      rateLimitKey("photoUpload", user.id ?? ip),
      RATE_LIMITS.photoUpload,
    );
    if (!limit.success) return fail("Хэт олон хүсэлт. Түр хүлээнэ үү.", 429);

    const { keys, captions } = postSchema.parse(await req.json());

    const biz = await loadBusiness(businessId);
    if (!biz) return fail("Бизнес олдсонгүй", 404);

    // Owner/moderator uploads are trusted → APPROVED; others await moderation.
    const status = canManage(biz, user) ? ("APPROVED" as const) : ("PENDING" as const);

    const photos = await db
      .insert(businessPhotos)
      .values(
        keys.map((key, i) => ({
          businessId,
          uploadedByUserId: user.id,
          imageUrl: publicUrlFor(key),
          caption: captions?.[i] ?? null,
          status,
        })),
      )
      .returning();

    if (status === "APPROVED") await recomputeBusinessAggregates(businessId);

    trackAsync({
      event: "photo_uploaded",
      businessId,
      userId: user.id,
      metadata: { count: photos.length },
    });

    return ok(
      { count: photos.length, ids: photos.map((p) => p.id), photos },
      { status: 201 },
    );
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const businessId = idSchema.parse(id);
    const user = await requireUser();
    const { photoId, isCover } = patchSchema.parse(await req.json());

    const biz = await loadBusiness(businessId);
    if (!biz) return fail("Бизнес олдсонгүй", 404);
    if (!canManage(biz, user)) throw new AuthError("Хандах эрх хүрэлцэхгүй байна", 403);

    if (isCover) {
      await db.transaction(async (tx) => {
        await tx
          .update(businessPhotos)
          .set({ isCover: false })
          .where(and(eq(businessPhotos.businessId, businessId), ne(businessPhotos.id, photoId)));
        await tx
          .update(businessPhotos)
          .set({ isCover: true })
          .where(and(eq(businessPhotos.id, photoId), eq(businessPhotos.businessId, businessId)));
      });
    }

    return ok({ photoId, isCover: !!isCover });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const businessId = idSchema.parse(id);
    const user = await requireUser();

    const photoId = new URL(req.url).searchParams.get("photoId");
    if (!photoId || !idSchema.safeParse(photoId).success) {
      return fail("photoId шаардлагатай", 422);
    }

    const biz = await loadBusiness(businessId);
    if (!biz) return fail("Бизнес олдсонгүй", 404);
    if (!canManage(biz, user)) throw new AuthError("Хандах эрх хүрэлцэхгүй байна", 403);

    await db
      .delete(businessPhotos)
      .where(and(eq(businessPhotos.id, photoId), eq(businessPhotos.businessId, businessId)));

    await recomputeBusinessAggregates(businessId);
    return ok({ deleted: true, photoId });
  } catch (e) {
    return handleError(e);
  }
}
