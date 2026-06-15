/**
 * Review data-access layer.
 *
 * Reads (public listing with users/photos/votes), writes (create/update/delete
 * with aggregate recomputation), votes, owner responses and moderation. The
 * one-review-per-user-per-business rule is enforced both by a DB unique index
 * and explicit checks here for friendly errors.
 */
import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  businesses,
  reviewPhotos,
  reviewVotes,
  reviews,
  users,
} from "@/db/schema";
import type { Review, ReviewStatus } from "@/db/schema";
import { PAGE_SIZE } from "@/lib/constants";
import { publicUrlFor } from "@/lib/storage/s3";
import { recomputeBusinessAggregates } from "./businesses";

/** Thrown for expected, user-facing errors so callers can map to 4xx. */
export class ReviewError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "ReviewError";
  }
}

export type ReviewSort = "newest" | "highest" | "lowest" | "useful";

export type ReviewListItem = Review & {
  user: { id: string; name: string | null; image: string | null };
  photos: { id: string; imageUrl: string; width: number | null; height: number | null }[];
};

export type ListReviewsParams = {
  sort?: ReviewSort;
  page?: number;
  pageSize?: number;
  status?: ReviewStatus;
};

/** Paginated reviews for a business, newest by default, with user + photos. */
export async function listReviews(
  businessId: string,
  params: ListReviewsParams = {},
): Promise<{ items: ReviewListItem[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, params.pageSize ?? PAGE_SIZE);
  const offset = (page - 1) * pageSize;
  const status = params.status ?? "PUBLISHED";

  const orderBy = (() => {
    switch (params.sort) {
      case "highest":
        return [desc(reviews.rating), desc(reviews.createdAt)];
      case "lowest":
        return [reviews.rating, desc(reviews.createdAt)];
      case "useful":
        return [desc(reviews.usefulCount), desc(reviews.createdAt)];
      default:
        return [desc(reviews.createdAt)];
    }
  })();

  const where = and(
    eq(reviews.businessId, businessId),
    eq(reviews.status, status),
  );

  const [rows, totalRow] = await Promise.all([
    db.query.reviews.findMany({
      where,
      orderBy,
      limit: pageSize,
      offset,
      with: {
        user: { columns: { id: true, name: true, image: true } },
        photos: {
          where: eq(reviewPhotos.status, "APPROVED"),
          columns: { id: true, imageUrl: true, width: true, height: true },
        },
      },
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(where),
  ]);

  const total = totalRow[0] ? Number(totalRow[0].count) : 0;
  return { items: rows as unknown as ReviewListItem[], total };
}

export type CreateReviewInput = {
  businessId: string;
  rating: number;
  title?: string | null;
  body: string;
  visitDate?: Date | null;
  photoKeys?: string[];
};

/**
 * Create a review in a transaction: insert the review (one per user/business,
 * rating 1..5), attach photos from object keys, then recompute the business
 * aggregates and bump the user's review_count. Returns the created review.
 */
export async function createReview(
  input: CreateReviewInput,
  userId: string,
): Promise<Review> {
  if (input.rating < 1 || input.rating > 5) {
    throw new ReviewError("Үнэлгээ 1-5 хооронд байх ёстой", 400);
  }

  // Friendly pre-check (the unique index is the real guarantee).
  const existing = await db.query.reviews.findFirst({
    where: and(eq(reviews.businessId, input.businessId), eq(reviews.userId, userId)),
    columns: { id: true },
  });
  if (existing) {
    throw new ReviewError("Та энэ газарт аль хэдийн сэтгэгдэл үлдээсэн байна", 409);
  }

  const biz = await db.query.businesses.findFirst({
    where: eq(businesses.id, input.businessId),
    columns: { id: true },
  });
  if (!biz) throw new ReviewError("Бизнес олдсонгүй", 404);

  const created = await db.transaction(async (tx) => {
    const [review] = await tx
      .insert(reviews)
      .values({
        businessId: input.businessId,
        userId,
        rating: input.rating,
        title: input.title ?? null,
        body: input.body,
        visitDate: input.visitDate ?? null,
        status: "PUBLISHED",
      })
      .returning();

    if (!review) throw new ReviewError("Сэтгэгдэл үүсгэж чадсангүй", 400);

    const keys = input.photoKeys ?? [];
    if (keys.length > 0) {
      await tx.insert(reviewPhotos).values(
        keys.slice(0, 8).map((key) => ({
          reviewId: review.id,
          businessId: input.businessId,
          userId,
          imageUrl: publicUrlFor(key),
          status: "PENDING" as const,
        })),
      );
    }

    await tx
      .update(users)
      .set({ reviewCount: sql`${users.reviewCount} + 1`, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return review;
  });

  await recomputeBusinessAggregates(input.businessId);
  return created;
}

export type UpdateReviewPatch = {
  rating?: number;
  title?: string | null;
  body?: string;
  visitDate?: Date | null;
};

/** Update a review owned by the user; recomputes aggregates when rating changes. */
export async function updateReview(
  reviewId: string,
  userId: string,
  patch: UpdateReviewPatch,
): Promise<Review> {
  const existing = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
  });
  if (!existing || existing.status === "DELETED") {
    throw new ReviewError("Сэтгэгдэл олдсонгүй", 404);
  }
  if (existing.userId !== userId) {
    throw new ReviewError("Зөвхөн өөрийн сэтгэгдлийг засах боломжтой", 403);
  }
  if (patch.rating != null && (patch.rating < 1 || patch.rating > 5)) {
    throw new ReviewError("Үнэлгээ 1-5 хооронд байх ёстой", 400);
  }

  const [updated] = await db
    .update(reviews)
    .set({
      ...(patch.rating != null ? { rating: patch.rating } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.visitDate !== undefined ? { visitDate: patch.visitDate } : {}),
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, reviewId))
    .returning();

  if (patch.rating != null) {
    await recomputeBusinessAggregates(existing.businessId);
  }
  return updated!;
}

/**
 * Soft-delete a review (status = DELETED). Author or moderator only. Decrements
 * the author's review_count and recomputes business aggregates.
 */
export async function deleteReview(
  reviewId: string,
  userId: string,
  isModerator = false,
): Promise<void> {
  const existing = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
  });
  if (!existing || existing.status === "DELETED") {
    throw new ReviewError("Сэтгэгдэл олдсонгүй", 404);
  }
  if (existing.userId !== userId && !isModerator) {
    throw new ReviewError("Устгах эрх хүрэлцэхгүй байна", 403);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(reviews)
      .set({ status: "DELETED", updatedAt: new Date() })
      .where(eq(reviews.id, reviewId));
    await tx
      .update(users)
      .set({ reviewCount: sql`GREATEST(${users.reviewCount} - 1, 0)`, updatedAt: new Date() })
      .where(eq(users.id, existing.userId));
  });

  await recomputeBusinessAggregates(existing.businessId);
}

export type VoteType = "USEFUL" | "FUNNY" | "COOL";

/** Maps a vote type to its denormalised counter column on `reviews`. */
const VOTE_FIELD = {
  USEFUL: "useful_count",
  FUNNY: "funny_count",
  COOL: "cool_count",
} as const;

/**
 * Toggle a vote of a given type on a review and keep the denormalised counter
 * in sync. Returns the new state and current count for that vote type.
 */
export async function voteReview(
  reviewId: string,
  userId: string,
  voteType: VoteType,
): Promise<{ voted: boolean; count: number }> {
  const col = sql.raw(VOTE_FIELD[voteType]);

  return db.transaction(async (tx) => {
    const existing = await tx.query.reviewVotes.findFirst({
      where: and(
        eq(reviewVotes.reviewId, reviewId),
        eq(reviewVotes.userId, userId),
        eq(reviewVotes.voteType, voteType),
      ),
      columns: { id: true },
    });

    let voted: boolean;
    if (existing) {
      await tx
        .delete(reviewVotes)
        .where(
          and(
            eq(reviewVotes.reviewId, reviewId),
            eq(reviewVotes.userId, userId),
            eq(reviewVotes.voteType, voteType),
          ),
        );
      await tx.execute(
        sql`UPDATE reviews SET ${col} = GREATEST(${col} - 1, 0) WHERE id = ${reviewId}`,
      );
      voted = false;
    } else {
      await tx
        .insert(reviewVotes)
        .values({ reviewId, userId, voteType })
        .onConflictDoNothing();
      await tx.execute(
        sql`UPDATE reviews SET ${col} = ${col} + 1 WHERE id = ${reviewId}`,
      );
      voted = true;
    }

    const [row] = (await tx.execute(
      sql`SELECT ${col} AS count FROM reviews WHERE id = ${reviewId}`,
    )) as unknown as Array<{ count: number }>;
    return { voted, count: row ? Number(row.count) : 0 };
  });
}

/**
 * Set/replace the owner's response on a review. Only the business owner may do
 * this. Passing an empty string clears the response.
 */
export async function setOwnerResponse(
  reviewId: string,
  ownerUserId: string,
  text: string,
): Promise<Review> {
  const review = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
    columns: { id: true, businessId: true },
  });
  if (!review) throw new ReviewError("Сэтгэгдэл олдсонгүй", 404);

  const biz = await db.query.businesses.findFirst({
    where: and(eq(businesses.id, review.businessId), eq(businesses.ownerUserId, ownerUserId)),
    columns: { id: true },
  });
  if (!biz) {
    throw new ReviewError("Зөвхөн бизнесийн эзэн хариу үлдээх боломжтой", 403);
  }

  const trimmed = text.trim();
  const [updated] = await db
    .update(reviews)
    .set({
      ownerResponse: trimmed.length > 0 ? trimmed : null,
      ownerResponseAt: trimmed.length > 0 ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, reviewId))
    .returning();

  return updated!;
}

/* ─────────────────────────── Moderation / admin ──────────────────────────── */

export type AdminReviewRow = Review & {
  user: { id: string; name: string | null; image: string | null } | null;
  business: { id: string; name: string; slug: string } | null;
  reportCount: number;
};

export type ListReviewsForAdminParams = {
  status?: ReviewStatus;
  reported?: boolean;
  page?: number;
  pageSize?: number;
};

/** Admin review queue: filter by status and/or "has open reports". */
export async function listReviewsForAdmin(
  params: ListReviewsForAdminParams,
): Promise<{ items: AdminReviewRow[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  const conds = [sql`1 = 1`];
  if (params.status) conds.push(sql`r.status = ${params.status}`);
  if (params.reported) {
    conds.push(sql`EXISTS (
      SELECT 1 FROM reports rep
      WHERE rep.target_type = 'REVIEW' AND rep.target_id = r.id AND rep.status = 'OPEN'
    )`);
  }
  const whereSql = sql.join(conds, sql` AND `);

  const rows = (await db.execute(sql`
    SELECT
      r.id, r.business_id, r.user_id, r.rating, r.title, r.body, r.status,
      r.visit_date, r.spam_score, r.useful_count, r.funny_count, r.cool_count,
      r.owner_response, r.owner_response_at, r.created_at, r.updated_at,
      u.id AS u_id, u.name AS u_name, u.image AS u_image,
      b.id AS b_id, b.name AS b_name, b.slug AS b_slug,
      (SELECT COUNT(*) FROM reports rep
        WHERE rep.target_type = 'REVIEW' AND rep.target_id = r.id)::int AS report_count,
      COUNT(*) OVER() AS total
    FROM reviews r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN businesses b ON b.id = r.business_id
    WHERE ${whereSql}
    ORDER BY r.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `)) as unknown as Array<Record<string, unknown>>;

  const total = rows.length > 0 ? Number(rows[0]!.total) : 0;
  const items: AdminReviewRow[] = rows.map((r) => ({
    id: r.id as string,
    businessId: r.business_id as string,
    userId: r.user_id as string,
    rating: r.rating as number,
    title: (r.title as string) ?? null,
    body: r.body as string,
    status: r.status as ReviewStatus,
    visitDate: r.visit_date ? new Date(r.visit_date as string) : null,
    spamScore: Number(r.spam_score ?? 0),
    usefulCount: Number(r.useful_count ?? 0),
    funnyCount: Number(r.funny_count ?? 0),
    coolCount: Number(r.cool_count ?? 0),
    ownerResponse: (r.owner_response as string) ?? null,
    ownerResponseAt: r.owner_response_at ? new Date(r.owner_response_at as string) : null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
    user: r.u_id
      ? { id: r.u_id as string, name: (r.u_name as string) ?? null, image: (r.u_image as string) ?? null }
      : null,
    business: r.b_id
      ? { id: r.b_id as string, name: r.b_name as string, slug: r.b_slug as string }
      : null,
    reportCount: Number(r.report_count ?? 0),
  }));

  return { items, total };
}

/** Moderator status change (PUBLISHED / PENDING / HIDDEN / DELETED) + recompute. */
export async function setReviewStatus(
  reviewId: string,
  status: ReviewStatus,
  _moderatorId: string,
): Promise<Review> {
  const existing = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
    columns: { id: true, businessId: true },
  });
  if (!existing) throw new ReviewError("Сэтгэгдэл олдсонгүй", 404);

  const [updated] = await db
    .update(reviews)
    .set({ status, updatedAt: new Date() })
    .where(eq(reviews.id, reviewId))
    .returning();

  await recomputeBusinessAggregates(existing.businessId);
  return updated!;
}
