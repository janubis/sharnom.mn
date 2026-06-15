/**
 * PATCH /api/admin/claims/[id] — approve or reject a business claim. MODERATOR+.
 * Body: { decision: "APPROVED" | "REJECTED", adminNote? }.
 */
import "server-only";

import { NextRequest } from "next/server";
import { z } from "zod";

import { auditLog } from "@/db/queries/users";
import { decideClaim, ClaimError } from "@/db/queries/claims";
import { ok, fail, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { idSchema } from "@/lib/validations";
import { actorContext } from "../../_lib";

export const dynamic = "force-dynamic";

const decideSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  adminNote: z.string().max(2000).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requireRole("MODERATOR");
    const id = idSchema.parse((await params).id);
    const { decision, adminNote } = decideSchema.parse(await req.json());

    const updated = await decideClaim(id, actor.id ?? "", decision, adminNote ?? null);

    const { actorId, ip } = await actorContext(actor);
    await auditLog(
      actorId,
      `claim.${decision.toLowerCase()}`,
      "claim",
      id,
      null,
      { decision, adminNote },
      ip,
    );

    return ok({ claim: updated });
  } catch (e) {
    if (e instanceof ClaimError) return fail(e.message, e.status);
    return handleError(e);
  }
}
