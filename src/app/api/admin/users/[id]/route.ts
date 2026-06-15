/**
 * /api/admin/users/[id]
 *   PATCH — change a user's role (ADMIN+, updateUserRoleSchema)
 *   POST  — ban / suspend / lift restriction (ADMIN+)
 *
 * SUPER_ADMIN targets are protected: only another SUPER_ADMIN may demote, ban
 * or suspend them. Actors can never promote others above their own rank, nor
 * act on their own account.
 */
import "server-only";

import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auditLog, banUser, setUserRole, unbanUser } from "@/db/queries/users";
import { ok, fail, handleError } from "@/lib/api";
import { hasRole, requireRole } from "@/lib/rbac";
import { idSchema, updateUserRoleSchema } from "@/lib/validations";
import type { UserRole } from "@/db/schema";
import { actorContext, isSuperAdmin } from "../../_lib";

export const dynamic = "force-dynamic";

const moderationSchema = z.object({
  action: z.enum(["ban", "suspend", "unban"]),
  until: z.coerce.date().optional(),
  reason: z.string().max(500).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requireRole("ADMIN");
    const id = idSchema.parse((await params).id);
    const { role } = updateUserRoleSchema.parse(await req.json());

    if (actor.id === id) return fail("Өөрийн эрхийг өөрчлөх боломжгүй", 403);

    const target = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!target) return fail("Хэрэглэгч олдсонгүй", 404);

    // Protect SUPER_ADMIN accounts from non-SUPER_ADMIN actors.
    if (isSuperAdmin(target.role) && !isSuperAdmin(actor.role as UserRole)) {
      return fail("SUPER_ADMIN хэрэглэгчийн эрхийг өөрчлөх боломжгүй", 403);
    }
    // An actor may not grant a role above their own rank.
    if (!hasRole(actor.role as UserRole, role)) {
      return fail("Өөрөөсөө дээгүүр эрх олгох боломжгүй", 403);
    }

    const updated = await setUserRole(id, role);

    const { actorId, ip } = await actorContext(actor);
    await auditLog(
      actorId,
      "user.role.update",
      "user",
      id,
      { role: target.role },
      { role: updated.role },
      ip,
    );

    return ok({ user: { id: updated.id, role: updated.role } });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requireRole("ADMIN");
    const id = idSchema.parse((await params).id);
    const input = moderationSchema.parse(await req.json());

    if (actor.id === id) return fail("Өөрийн бүртгэлд хязгаарлалт тавих боломжгүй", 403);

    const target = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!target) return fail("Хэрэглэгч олдсонгүй", 404);

    if (isSuperAdmin(target.role) && !isSuperAdmin(actor.role as UserRole)) {
      return fail("SUPER_ADMIN хэрэглэгчид хязгаарлалт тавих боломжгүй", 403);
    }

    let updated;
    if (input.action === "unban") {
      updated = await unbanUser(id);
    } else if (input.action === "suspend") {
      // Default to a 30-day suspension when no explicit end date is provided.
      const until =
        input.until ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      updated = await banUser(id, { until });
    } else {
      updated = await banUser(id, { permanent: true });
    }

    const { actorId, ip } = await actorContext(actor);
    await auditLog(
      actorId,
      `user.${input.action}`,
      "user",
      id,
      { bannedAt: target.bannedAt, suspendedUntil: target.suspendedUntil },
      { bannedAt: updated.bannedAt, suspendedUntil: updated.suspendedUntil, reason: input.reason },
      ip,
    );

    return ok({
      user: {
        id: updated.id,
        bannedAt: updated.bannedAt,
        suspendedUntil: updated.suspendedUntil,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
