/**
 * /api/admin/categories/[id]
 *   PUT    — update a category (ADMIN+, categorySchema partial)
 *   DELETE — delete a category (ADMIN+); blocked if it has children
 */
import "server-only";

import { NextRequest } from "next/server";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { auditLog } from "@/db/queries/users";
import { ok, fail, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { categorySchema, idSchema } from "@/lib/validations";
import { actorContext } from "../../_lib";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requireRole("ADMIN");
    const id = idSchema.parse((await params).id);
    const input = categorySchema.partial().parse(await req.json());

    const before = await db.query.categories.findFirst({
      where: eq(categories.id, id),
    });
    if (!before) return fail("Ангилал олдсонгүй", 404);

    if (input.parentId === id) {
      return fail("Ангилал өөрийгөө эцэг ангилал болгох боломжгүй", 422);
    }
    if (input.slug && input.slug !== before.slug) {
      const dup = await db.query.categories.findFirst({
        where: and(eq(categories.slug, input.slug), ne(categories.id, id)),
        columns: { id: true },
      });
      if (dup) return fail("Энэ slug-тай ангилал аль хэдийн байна", 409);
    }

    const [updated] = await db
      .update(categories)
      .set({
        ...(input.nameMn !== undefined ? { nameMn: input.nameMn } : {}),
        ...(input.nameEn !== undefined ? { nameEn: input.nameEn ?? null } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId ?? null } : {}),
        ...(input.icon !== undefined ? { icon: input.icon ?? null } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      })
      .where(eq(categories.id, id))
      .returning();

    const { actorId, ip } = await actorContext(actor);
    await auditLog(actorId, "category.update", "category", id, before, updated, ip);

    return ok({ category: updated });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const actor = await requireRole("ADMIN");
    const id = idSchema.parse((await params).id);

    const before = await db.query.categories.findFirst({
      where: eq(categories.id, id),
    });
    if (!before) return fail("Ангилал олдсонгүй", 404);

    const child = await db.query.categories.findFirst({
      where: eq(categories.parentId, id),
      columns: { id: true },
    });
    if (child) {
      return fail("Дэд ангилалтай тул устгах боломжгүй", 409);
    }

    // primary_category_id is ON DELETE SET NULL, so businesses are not orphaned.
    await db.delete(categories).where(eq(categories.id, id));

    const { actorId, ip } = await actorContext(actor);
    await auditLog(actorId, "category.delete", "category", id, before, null, ip);

    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
