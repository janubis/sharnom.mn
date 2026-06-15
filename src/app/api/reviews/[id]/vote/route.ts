/**
 * POST /api/reviews/:id/vote — toggle a USEFUL / FUNNY / COOL vote on a review.
 */
import "server-only";

import { fail, handleError, ok } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { ReviewError, voteReview } from "@/db/queries/reviews";
import { idSchema, reviewVoteSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const reviewId = idSchema.parse(id);

    const user = await requireUser();

    const body = await req.json();
    const { voteType } = reviewVoteSchema.parse(body);

    const result = await voteReview(reviewId, user.id, voteType);

    return ok({ voted: result.voted, voteType, count: result.count });
  } catch (e) {
    if (e instanceof ReviewError) return fail(e.message, e.status);
    return handleError(e);
  }
}
