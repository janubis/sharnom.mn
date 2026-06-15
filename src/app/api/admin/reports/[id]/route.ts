/**
 * PATCH /api/admin/reports/[id] — resolve / dismiss / start reviewing a report.
 * MODERATOR+. Body: { status: "REVIEWING" | "RESOLVED" | "DISMISSED" }.
 */
import "server-only";

import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { reports } from "@/db/schema";
import { auditLog } from "@/db/queries/users";
import { ok, fail, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { idSchema } from "@/lib/validations";
import { actorContext } from "../../_lib";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requireRole("MODERATOR");
    const id = idSchema.parse((await params).id);
    const { status } = patchSchema.parse(await req.json());

    const existing = await db.query.reports.findFirst({
      where: eq(reports.id, id),
      columns: { id: true, status: true, targetType: true, targetId: true },
    });
    if (!existing) return fail("Гомдол олдсонгүй", 404);

    const resolved = status === "RESOLVED" || status === "DISMISSED";
    const [updated] = await db
      .update(reports)
      .set({
        status,
        resolvedBy: resolved ? (actor.id ?? null) : null,
        resolvedAt: resolved ? new Date() : null,
      })
      .where(eq(reports.id, id))
      .returning();

    const { actorId, ip } = await actorContext(actor);
    await auditLog(
      actorId,
      `report.${status.toLowerCase()}`,
      "report",
      id,
      { status: existing.status },
      { status },
      ip,
    );

    return ok({ report: updated });
  } catch (e) {
    return handleError(e);
  }
}
