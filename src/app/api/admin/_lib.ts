/**
 * Shared helpers for the admin API surface.
 *
 * Centralises the "who is acting + from where" context used for audit logging
 * and SUPER_ADMIN-protection checks, plus tiny parsers reused across handlers.
 */
import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  businessContacts,
  businessHours,
  businessLocations,
  businesses,
  categories,
} from "@/db/schema";
import { getClientIp } from "@/lib/api";
import { isAdmin } from "@/lib/rbac";
import { slugify } from "@/lib/utils";
import { normalizeBusinessName } from "@/lib/normalize";
import type { UpsertBusinessInput } from "@/lib/validations";
import type { Business, UserRole } from "@/db/schema";

/** Minimal shape of the session user our guards return. */
export type Actor = {
  id: string;
  role?: UserRole;
  [key: string]: unknown;
};

/** Resolve the actor id + client IP for audit-log writes. */
export async function actorContext(user: { id?: string | null }): Promise<{
  actorId: string;
  ip: string | null;
}> {
  return { actorId: user.id ?? "", ip: await getClientIp() };
}

/** True when the actor outranks (or equals) SUPER_ADMIN — i.e. is a SUPER_ADMIN. */
export function isSuperAdmin(role?: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

/** Coerce a positive integer query param with a fallback. */
export function intParam(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Map an analytics "range" token (7d/30d/90d) to a day count. */
export function rangeToDays(range: string | null): number {
  switch (range) {
    case "7d":
      return 7;
    case "90d":
      return 90;
    case "1y":
      return 365;
    case "30d":
    default:
      return 30;
  }
}

export { isAdmin };

/* ────────────────────── Business create / update (admin) ─────────────────── */

/** Generate a unique slug from a name, appending a numeric suffix on collision. */
async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  for (let i = 0; i < 50; i++) {
    const existing = await db.query.businesses.findFirst({
      where: eq(businesses.slug, candidate),
      columns: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Resolve a leaf category slug to its id (null when unknown/unset). */
async function categoryIdFromSlug(slug?: string): Promise<string | null> {
  if (!slug) return null;
  const row = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
    columns: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Create a business plus its contact / location / hours rows in one transaction.
 * `source` defaults to "manual"; admin-created businesses are ACTIVE + published.
 * Returns the inserted business row.
 */
export async function createBusinessAdmin(
  input: UpsertBusinessInput,
  opts: { source?: string } = {},
): Promise<Business> {
  const slug = await uniqueSlug(input.name);
  const categoryId = await categoryIdFromSlug(input.primaryCategorySlug);

  return db.transaction(async (tx) => {
    const [biz] = await tx
      .insert(businesses)
      .values({
        name: input.name,
        normalizedName: normalizeBusinessName(input.name),
        slug,
        description: input.description ?? null,
        primaryCategoryId: categoryId,
        priceLevel: input.priceLevel ?? null,
        status: "ACTIVE",
        source: opts.source ?? "manual",
        publishedAt: new Date(),
      })
      .returning();

    if (!biz) throw new Error("Бизнес үүсгэж чадсангүй");

    await applyContact(tx, biz.id, input);
    await applyLocation(tx, biz.id, input);
    await applyHours(tx, biz.id, input.hours);

    return biz;
  });
}

/**
 * Update an existing business and its child rows in one transaction. Only
 * provided fields are touched. Recomputes the slug only when the name changes.
 * Returns the updated business, or null if it doesn't exist / is deleted.
 */
export async function updateBusinessAdmin(
  id: string,
  input: Partial<UpsertBusinessInput>,
): Promise<Business | null> {
  const existing = await db.query.businesses.findFirst({
    where: eq(businesses.id, id),
  });
  if (!existing || existing.status === "DELETED") return null;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    patch.name = input.name;
    patch.normalizedName = normalizeBusinessName(input.name);
    if (input.name !== existing.name) {
      patch.slug = await uniqueSlug(input.name, id);
    }
  }
  if (input.description !== undefined) patch.description = input.description ?? null;
  if (input.priceLevel !== undefined) patch.priceLevel = input.priceLevel ?? null;
  if (input.primaryCategorySlug !== undefined) {
    patch.primaryCategoryId = await categoryIdFromSlug(input.primaryCategorySlug);
  }

  return db.transaction(async (tx) => {
    const [biz] = await tx
      .update(businesses)
      .set(patch)
      .where(eq(businesses.id, id))
      .returning();

    if (hasAny(input, ["phone", "email", "website", "facebookUrl", "instagramUrl"])) {
      await applyContact(tx, id, input, true);
    }
    if (
      hasAny(input, [
        "addressText",
        "district",
        "khoroo",
        "latitude",
        "longitude",
      ])
    ) {
      await applyLocation(tx, id, input, true);
    }
    if (input.hours !== undefined) {
      await applyHours(tx, id, input.hours, true);
    }

    return biz ?? null;
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function hasAny(obj: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((k) => obj[k] !== undefined);
}

async function applyContact(
  tx: Tx,
  businessId: string,
  input: Partial<UpsertBusinessInput>,
  patchOnly = false,
): Promise<void> {
  const values = {
    phone: input.phone ?? null,
    email: input.email || null,
    website: input.website || null,
    facebookUrl: input.facebookUrl || null,
    instagramUrl: input.instagramUrl || null,
  };
  const existing = await tx.query.businessContacts.findFirst({
    where: eq(businessContacts.businessId, businessId),
    columns: { id: true },
  });
  if (existing) {
    await tx
      .update(businessContacts)
      .set(values)
      .where(eq(businessContacts.businessId, businessId));
  } else if (!patchOnly || Object.values(values).some((v) => v != null)) {
    await tx.insert(businessContacts).values({ businessId, ...values });
  }
}

async function applyLocation(
  tx: Tx,
  businessId: string,
  input: Partial<UpsertBusinessInput>,
  patchOnly = false,
): Promise<void> {
  const values = {
    addressText: input.addressText ?? null,
    district: input.district ?? null,
    khoroo: input.khoroo ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    updatedAt: new Date(),
  };
  const existing = await tx.query.businessLocations.findFirst({
    where: eq(businessLocations.businessId, businessId),
    columns: { id: true },
  });
  if (existing) {
    await tx
      .update(businessLocations)
      .set(values)
      .where(eq(businessLocations.businessId, businessId));
  } else if (!patchOnly || Object.values(values).some((v) => v != null)) {
    await tx.insert(businessLocations).values({ businessId, ...values });
  }
}

async function applyHours(
  tx: Tx,
  businessId: string,
  hours: UpsertBusinessInput["hours"],
  replace = false,
): Promise<void> {
  if (!hours) return;
  if (replace) {
    await tx.delete(businessHours).where(eq(businessHours.businessId, businessId));
  }
  if (hours.length === 0) return;
  await tx
    .insert(businessHours)
    .values(
      hours.map((h) => ({
        businessId,
        dayOfWeek: h.dayOfWeek,
        openTime: h.openTime ?? null,
        closeTime: h.closeTime ?? null,
        isClosed: h.isClosed,
      })),
    )
    .onConflictDoUpdate({
      target: [businessHours.businessId, businessHours.dayOfWeek],
      set: {
        openTime: sql`excluded.open_time`,
        closeTime: sql`excluded.close_time`,
        isClosed: sql`excluded.is_closed`,
      },
    });
}

/** Soft-delete a business (status = DELETED). Returns false if already gone. */
export async function softDeleteBusiness(id: string): Promise<boolean> {
  const result = await db
    .update(businesses)
    .set({ status: "DELETED", updatedAt: new Date() })
    .where(and(eq(businesses.id, id), sql`${businesses.status} <> 'DELETED'`))
    .returning({ id: businesses.id });
  return result.length > 0;
}
