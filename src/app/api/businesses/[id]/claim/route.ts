/**
 * POST /api/businesses/:id/claim — claim ownership of a business.
 *
 * Creates a PENDING claim (a moderator approves/rejects later). Tracks the
 * claim_submitted analytics event.
 */
import "server-only";

import { fail, getClientIp, handleError, ok } from "@/lib/api";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { requireUser } from "@/lib/rbac";
import { ClaimError, createClaim } from "@/db/queries/claims";
import { trackAsync } from "@/lib/analytics/track";
import { claimSchema, idSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const businessId = idSchema.parse(id);

    const user = await requireUser();

    const ip = await getClientIp();
    const limit = await rateLimit(
      rateLimitKey("claim", user.id ?? ip),
      RATE_LIMITS.claim,
    );
    if (!limit.success) return fail("Хэт олон хүсэлт. Түр хүлээнэ үү.", 429);

    const body = await req.json();
    const input = claimSchema.parse(body);

    const claim = await createClaim(businessId, user.id, {
      verificationMethod: input.verificationMethod,
      contactPhone: input.contactPhone ?? null,
      evidenceUrl: input.evidenceUrl ?? null,
      note: input.note ?? null,
    });

    trackAsync({
      event: "claim_submitted",
      businessId,
      userId: user.id,
      metadata: { claimId: claim.id, method: input.verificationMethod },
    });

    return ok({ claimId: claim.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ClaimError) return fail(e.message, e.status);
    return handleError(e);
  }
}
