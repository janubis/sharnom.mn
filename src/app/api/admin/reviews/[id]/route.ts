/**
 * /api/admin/reviews/[id]
 *   PATCH  — set moderation status (MODERATOR+, setReviewStatus)
 *   DELETE — soft-delete the review (MODERATOR+)
 */
import "server-only";

import { NextRequest } from "next/server";
import { z } from "zod";

import { auditLog } from "@/db/queries/users";
import { deleteReview, setReviewStatus, ReviewError } from "@/db/queries/reviews";
import { ok, fail, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { idSchema } from "@/lib/validations";
import { actorContext } from "../../_lib";

export const dynamic = "force-dynamic";

const statusSchema = z.object({
  status: z.enum(["PUBLISHED", "PENDING", "HIDDEN", "DELETED"]),
});

type Ctx = { params: Promise<{ id: string }> };

function mapReviewError(e: unknown) {
  if (e instanceof ReviewError) return fail(e.message, e.status);
  return handleError(e);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requireRole("MODERATOR");
    const id = idSchema.parse((await params).id);
    const { status } = statusSchema.parse(await req.json());

    const updated = await setReviewStatus(id, status, actor.id ?? "");

    const { actorId, ip } = await actorContext(actor);
    await auditLog(actorId, "review.status", "review", id, null, { status }, ip);

    return ok({ review: { id: updated.id, status: updated.status } });
  } catch (e) {
    return mapReviewError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requireRole("MODERATOR");
    const id = idSchema.parse((await params).id);

    await deleteReview(id, actor.id ?? "", true);

    const { actorId, ip } = await actorContext(actor);
    await auditLog(actorId, "review.delete", "review", id, null, null, ip);

    return ok({ deleted: true });
  } catch (e) {
    return mapReviewError(e);
  }
}
