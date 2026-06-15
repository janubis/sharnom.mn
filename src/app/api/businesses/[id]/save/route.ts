/**
 * POST /api/businesses/:id/save — toggle a save/bookmark for the current user.
 */
import "server-only";

import { fail, getClientIp, handleError, ok } from "@/lib/api";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { requireUser } from "@/lib/rbac";
import { toggleSave } from "@/db/queries/saved";
import { trackAsync } from "@/lib/analytics/track";
import { idSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const businessId = idSchema.parse(id);

    const user = await requireUser();

    const ip = await getClientIp();
    const limit = await rateLimit(
      rateLimitKey("save", user.id ?? ip),
      RATE_LIMITS.suggestEdit,
    );
    if (!limit.success) return fail("Хэт олон хүсэлт. Түр хүлээнэ үү.", 429);

    const saved = await toggleSave(user.id, businessId);

    trackAsync({
      event: "business_saved",
      businessId,
      userId: user.id,
      metadata: { saved },
    });

    return ok({ saved });
  } catch (e) {
    return handleError(e);
  }
}
