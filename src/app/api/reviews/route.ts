/**
 * /api/reviews
 *   GET  — paginated reviews for a business (sort + page), used by the business
 *          detail "load more" / sort control. Returns ReviewView-shaped items.
 *   POST — create a review (one per user per business).
 */
import "server-only";

import { z } from "zod";

import { fail, getClientIp, handleError, ok, searchParamsToObject } from "@/lib/api";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { requireUser } from "@/lib/rbac";
import { createReview, listReviews, ReviewError } from "@/db/queries/reviews";
import { trackAsync } from "@/lib/analytics/track";
import { createReviewSchema, idSchema } from "@/lib/validations";
import { PAGE_SIZE } from "@/lib/constants";

export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  businessId: idSchema,
  sort: z.enum(["newest", "highest", "lowest", "useful"]).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  pageSize: z.coerce.number().int().min(1).max(60).optional(),
});

const toIso = (d: Date | string | null) =>
  d == null ? null : d instanceof Date ? d.toISOString() : d;

export async function GET(req: Request) {
  try {
    const { businessId, sort, page, pageSize } = listQuerySchema.parse(
      searchParamsToObject(req.url),
    );
    const size = pageSize ?? PAGE_SIZE;
    const current = page ?? 1;

    const { items, total } = await listReviews(businessId, {
      sort,
      page: current,
      pageSize: size,
    });

    // Project to the ReviewView shape (ISO date strings) the client renders.
    const views = items.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      createdAt: toIso(r.createdAt),
      visitDate: toIso(r.visitDate),
      usefulCount: r.usefulCount,
      funnyCount: r.funnyCount,
      coolCount: r.coolCount,
      ownerResponse: r.ownerResponse,
      ownerResponseAt: toIso(r.ownerResponseAt),
      user: r.user,
      photos: r.photos.map((p) => ({ id: p.id, imageUrl: p.imageUrl })),
    }));

    return ok({
      items: views,
      total,
      hasMore: (current - 1) * size + views.length < total,
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const ip = await getClientIp();
    const limit = await rateLimit(
      rateLimitKey("review", user.id ?? ip),
      RATE_LIMITS.review,
    );
    if (!limit.success) return fail("Хэт олон сэтгэгдэл. Түр хүлээнэ үү.", 429);

    const body = await req.json();
    const input = createReviewSchema.parse(body);

    const review = await createReview(
      {
        businessId: input.businessId,
        rating: input.rating,
        title: input.title ?? null,
        body: input.body,
        visitDate: input.visitDate ?? null,
        photoKeys: input.photoKeys,
      },
      user.id,
    );

    trackAsync({
      event: "review_created",
      businessId: input.businessId,
      userId: user.id,
      metadata: { rating: input.rating, reviewId: review.id },
    });

    return ok(review, { status: 201 });
  } catch (e) {
    if (e instanceof ReviewError) return fail(e.message, e.status);
    return handleError(e);
  }
}
