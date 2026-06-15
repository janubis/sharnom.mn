/**
 * /api/admin/categories
 *   GET  — full category tree (MODERATOR+)
 *   POST — create a category (ADMIN+, categorySchema)
 */
import "server-only";

import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { auditLog } from "@/db/queries/users";
import { getCategoryTree } from "@/db/queries/categories";
import { ok, fail, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { categorySchema } from "@/lib/validations";
import { actorContext } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("MODERATOR");
    const tree = await getCategoryTree();
    return ok({ tree });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN");
    const input = categorySchema.parse(await req.json());

    const dup = await db.query.categories.findFirst({
      where: eq(categories.slug, input.slug),
      columns: { id: true },
    });
    if (dup) return fail("Энэ slug-тай ангилал аль хэдийн байна", 409);

    const [created] = await db
      .insert(categories)
      .values({
        nameMn: input.nameMn,
        nameEn: input.nameEn ?? null,
        slug: input.slug,
        parentId: input.parentId ?? null,
        icon: input.icon ?? null,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();

    const { actorId, ip } = await actorContext(actor);
    await auditLog(actorId, "category.create", "category", created!.id, null, created, ip);

    return ok({ category: created }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
