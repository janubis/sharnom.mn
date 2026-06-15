/**
 * POST /api/businesses/:id/suggest-edit — community edit suggestion.
 *
 * Records a PENDING suggestion (moderators apply the allowed fields later).
 */
import "server-only";

import { fail, getClientIp, handleError, ok } from "@/lib/api";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { requireUser } from "@/lib/rbac";
import { createSuggestion, SuggestionError } from "@/db/queries/suggestions";
import { idSchema, suggestEditSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const businessId = idSchema.parse(id);

    const user = await requireUser();

    const ip = await getClientIp();
    const limit = await rateLimit(
      rateLimitKey("suggestEdit", user.id ?? ip),
      RATE_LIMITS.suggestEdit,
    );
    if (!limit.success) return fail("Хэт олон хүсэлт. Түр хүлээнэ үү.", 429);

    const body = await req.json();
    const { payload } = suggestEditSchema.parse(body);

    const suggestion = await createSuggestion(businessId, user.id, payload);

    return ok({ id: suggestion.id, status: suggestion.status }, { status: 201 });
  } catch (e) {
    if (e instanceof SuggestionError) return fail(e.message, e.status);
    return handleError(e);
  }
}
