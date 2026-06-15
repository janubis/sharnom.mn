/**
 * POST /api/owner/businesses/:id/respond-review — owner replies to a review.
 *
 * Body: { reviewId, response }. setOwnerResponse verifies the responder owns
 * the business the review belongs to; passing an empty response clears it.
 */
import "server-only";

import { fail, handleError, ok } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { ReviewError, setOwnerResponse } from "@/db/queries/reviews";
import { idSchema, ownerResponseSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const bodySchema = ownerResponseSchema.extend({ reviewId: idSchema });

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    // The business id in the path is validated for shape; ownership of the
    // review's business is enforced inside setOwnerResponse.
    const { id } = await params;
    idSchema.parse(id);

    const user = await requireRole("OWNER");

    const body = await req.json();
    const { reviewId, response } = bodySchema.parse(body);

    const updated = await setOwnerResponse(reviewId, user.id, response);

    return ok(updated);
  } catch (e) {
    if (e instanceof ReviewError) return fail(e.message, e.status);
    return handleError(e);
  }
}
