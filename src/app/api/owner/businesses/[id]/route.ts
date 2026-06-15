/**
 * PUT /api/owner/businesses/:id — owner edits their own business.
 *
 * Verifies ownership, then applies a partial upsertBusinessSchema across the
 * businesses / contact / location / hours tables in a single transaction.
 * Recomputes profile completeness and writes an audit-log entry.
 */
import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  businessContacts,
  businessHours,
  businessLocations,
  businesses,
} from "@/db/schema";
import { fail, getClientIp, handleError, ok } from "@/lib/api";
import { getCategoryIdBySlug } from "@/db/queries/categories";
import { recomputeBusinessAggregates, userOwnsBusiness } from "@/db/queries/businesses";
import { auditLog } from "@/db/queries/users";
import { requireRole } from "@/lib/rbac";
import { idSchema, upsertBusinessSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const patchSchema = upsertBusinessSchema.partial();

/** Treat empty strings (from optional URL/email fields) as "clear". */
function nullify<T extends string | null | undefined>(v: T): string | null {
  if (v === undefined) return null;
  if (v === null) return null;
  const t = String(v).trim();
  return t.length > 0 ? t : null;
}

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const businessId = idSchema.parse(id);

    const user = await requireRole("OWNER");

    const owns = await userOwnsBusiness(user.id, businessId);
    if (!owns) return fail("Энэ бизнес танд харьяалагдахгүй байна", 403);

    const body = await req.json();
    const patch = patchSchema.parse(body);

    // Resolve a category slug → id once (outside the transaction).
    let primaryCategoryId: string | null | undefined;
    if (patch.primaryCategorySlug !== undefined) {
      primaryCategoryId = await getCategoryIdBySlug(patch.primaryCategorySlug);
      if (!primaryCategoryId) return fail("Буруу ангилал", 422);
    }

    await db.transaction(async (tx) => {
      // ── businesses ────────────────────────────────────────────────────
      const bizPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) bizPatch.name = patch.name;
      if (patch.description !== undefined) bizPatch.description = nullify(patch.description);
      if (patch.priceLevel !== undefined) bizPatch.priceLevel = patch.priceLevel ?? null;
      if (primaryCategoryId !== undefined) bizPatch.primaryCategoryId = primaryCategoryId;
      if (Object.keys(bizPatch).length > 0) {
        await tx
          .update(businesses)
          .set({ ...bizPatch, updatedAt: new Date() })
          .where(eq(businesses.id, businessId));
      }

      // ── contact ───────────────────────────────────────────────────────
      const contactPatch: Record<string, unknown> = {};
      if (patch.phone !== undefined) contactPatch.phone = nullify(patch.phone);
      if (patch.email !== undefined) contactPatch.email = nullify(patch.email);
      if (patch.website !== undefined) contactPatch.website = nullify(patch.website);
      if (patch.facebookUrl !== undefined) contactPatch.facebookUrl = nullify(patch.facebookUrl);
      if (patch.instagramUrl !== undefined) contactPatch.instagramUrl = nullify(patch.instagramUrl);
      if (Object.keys(contactPatch).length > 0) {
        const existing = await tx.query.businessContacts.findFirst({
          where: eq(businessContacts.businessId, businessId),
          columns: { id: true },
        });
        if (existing) {
          await tx
            .update(businessContacts)
            .set(contactPatch)
            .where(eq(businessContacts.businessId, businessId));
        } else {
          await tx.insert(businessContacts).values({ businessId, ...contactPatch });
        }
      }

      // ── location ──────────────────────────────────────────────────────
      const locPatch: Record<string, unknown> = {};
      if (patch.addressText !== undefined) locPatch.addressText = nullify(patch.addressText);
      if (patch.district !== undefined) locPatch.district = nullify(patch.district);
      if (patch.khoroo !== undefined) locPatch.khoroo = nullify(patch.khoroo);
      if (patch.latitude !== undefined) locPatch.latitude = patch.latitude ?? null;
      if (patch.longitude !== undefined) locPatch.longitude = patch.longitude ?? null;
      if (Object.keys(locPatch).length > 0) {
        const existing = await tx.query.businessLocations.findFirst({
          where: eq(businessLocations.businessId, businessId),
          columns: { id: true },
        });
        if (existing) {
          await tx
            .update(businessLocations)
            .set({ ...locPatch, updatedAt: new Date() })
            .where(eq(businessLocations.businessId, businessId));
        } else {
          await tx.insert(businessLocations).values({ businessId, ...locPatch });
        }
      }

      // ── hours (full replace when provided) ──────────────────────────────
      if (patch.hours !== undefined) {
        await tx.delete(businessHours).where(eq(businessHours.businessId, businessId));
        if (patch.hours.length > 0) {
          await tx.insert(businessHours).values(
            patch.hours.map((h) => ({
              businessId,
              dayOfWeek: h.dayOfWeek,
              openTime: h.isClosed ? null : (h.openTime ?? null),
              closeTime: h.isClosed ? null : (h.closeTime ?? null),
              isClosed: h.isClosed,
            })),
          );
        }
      }
    });

    // Keeps completeness_score & photo/rating aggregates fresh.
    await recomputeBusinessAggregates(businessId);

    const ip = await getClientIp();
    await auditLog(user.id, "owner.business.update", "business", businessId, undefined, patch, ip);

    return ok({ updated: true });
  } catch (e) {
    return handleError(e);
  }
}
