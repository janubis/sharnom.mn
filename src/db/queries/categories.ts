/**
 * Category taxonomy queries — drive the nav mega-menu, category landing pages,
 * "popular categories" home section and filter facets.
 */
import "server-only";

import { asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories } from "@/db/schema";
import type { Category } from "@/db/schema";

export type CategoryNode = Category & { children: Category[] };

/** Full two-level tree: parents (sorted) each with their ordered children. */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const all = await db.query.categories.findMany({
    orderBy: [asc(categories.sortOrder), asc(categories.nameMn)],
  });

  const parents = all.filter((c) => c.parentId === null);
  const byParent = new Map<string, Category[]>();
  for (const c of all) {
    if (c.parentId) {
      const list = byParent.get(c.parentId) ?? [];
      list.push(c);
      byParent.set(c.parentId, list);
    }
  }

  return parents.map((p) => ({ ...p, children: byParent.get(p.id) ?? [] }));
}

export type CategoryWithRelations = {
  category: Category;
  parent: Category | null;
  children: Category[];
};

/** Category by slug, including its parent and (if a parent) its children. */
export async function getCategoryBySlug(
  slug: string,
): Promise<CategoryWithRelations | null> {
  const category = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
  });
  if (!category) return null;

  const [parent, children] = await Promise.all([
    category.parentId
      ? db.query.categories
          .findFirst({ where: eq(categories.id, category.parentId) })
          .then((c) => c ?? null)
      : Promise.resolve(null),
    db.query.categories.findMany({
      where: eq(categories.parentId, category.id),
      orderBy: [asc(categories.sortOrder), asc(categories.nameMn)],
    }),
  ]);

  return { category, parent, children };
}

/**
 * Popular leaf categories (those with a parent) ranked by their denormalised
 * business_count. Used for the home "browse by category" grid.
 */
export async function getPopularCategories(limit = 12): Promise<Category[]> {
  return db.query.categories.findMany({
    where: sql`${categories.parentId} IS NOT NULL`,
    orderBy: [desc(categories.businessCount), asc(categories.sortOrder)],
    limit,
  });
}

/** Resolve a category id from its slug (lightweight). */
export async function getCategoryIdBySlug(slug: string): Promise<string | null> {
  const row = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
    columns: { id: true },
  });
  return row?.id ?? null;
}

/** Top-level parent categories only (for compact navigation). */
export async function getParentCategories(): Promise<Category[]> {
  return db.query.categories.findMany({
    where: isNull(categories.parentId),
    orderBy: [asc(categories.sortOrder), asc(categories.nameMn)],
  });
}
