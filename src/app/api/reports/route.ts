/**
 * POST /api/reports — flag a business / review / photo / user for moderation.
 *
 * Inserts an OPEN report; moderators triage it from the admin queue.
 */
import "server-only";

import { db } from "@/db";
import { reports } from "@/db/schema";
import { fail, getClientIp, handleError, ok } from "@/lib/api";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { requireUser } from "@/lib/rbac";
import { reportSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const ip = await getClientIp();
    const limit = await rateLimit(
      rateLimitKey("report", user.id ?? ip),
      RATE_LIMITS.report,
    );
    if (!limit.success) return fail("Хэт олон хүсэлт. Түр хүлээнэ үү.", 429);

    const body = await req.json();
    const input = reportSchema.parse(body);

    const [created] = await db
      .insert(reports)
      .values({
        reporterUserId: user.id,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        detail: input.detail ?? null,
        status: "OPEN",
      })
      .returning({ id: reports.id });

    return ok({ id: created!.id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
