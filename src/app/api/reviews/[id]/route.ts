/**
 * PUT    /api/reviews/:id — update a review (author only).
 * DELETE /api/reviews/:id — soft-delete a review (author or moderator).
 */
import "server-only";

import { fail, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { isModerator } from "@/lib/rbac";
import { deleteReview, ReviewError, updateReview } from "@/db/queries/reviews";
import { idSchema, updateReviewSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const reviewId = idSchema.parse(id);

    const user = await requireUser();

    const body = await req.json();
    const patch = updateReviewSchema.parse(body);

    const updated = await updateReview(reviewId, user.id, {
      rating: patch.rating,
      title: patch.title,
      body: patch.body,
      visitDate: patch.visitDate,
    });

    return ok(updated);
  } catch (e) {
    if (e instanceof ReviewError) return fail(e.message, e.status);
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const reviewId = idSchema.parse(id);

    const user = await requireUser();

    await deleteReview(reviewId, user.id, isModerator(user.role));

    return ok({ deleted: true });
  } catch (e) {
    if (e instanceof ReviewError) return fail(e.message, e.status);
    return handleError(e);
  }
}
