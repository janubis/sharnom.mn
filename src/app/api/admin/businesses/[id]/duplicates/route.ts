/**
 * GET /api/admin/businesses/[id]/duplicates — likely duplicate candidates for
 * the admin merge tool (MODERATOR+). Same normalized name or within ~80 m.
 */
import "server-only";

import { NextRequest } from "next/server";

import { findDuplicateCandidates } from "@/db/queries/businesses";
import { handleError, ok } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { idSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    await requireRole("MODERATOR");
    const id = idSchema.parse((await params).id);
    const candidates = await findDuplicateCandidates(id);
    return ok({ candidates });
  } catch (e) {
    return handleError(e);
  }
}
