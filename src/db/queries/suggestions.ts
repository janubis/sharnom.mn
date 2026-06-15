/**
 * Community edit-suggestion flow. Users propose field changes to a business;
 * moderators approve (applying allowed fields) or reject. Fields protected by
 * a manually-verified business are never overwritten on approval.
 */
import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  businessContacts,
  businessEditSuggestions,
  businessLocations,
  businesses,
  suggestionStatusEnum,
} from "@/db/schema";
import type { EditSuggestion } from "@/db/schema";
import { PAGE_SIZE } from "@/lib/constants";

export type SuggestionStatus = (typeof suggestionStatusEnum.enumValues)[number];
type SuggestionDecision = "APPROVED" | "REJECTED";

export class SuggestionError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "SuggestionError";
  }
}

/** Fields a community suggestion is allowed to change, grouped by target table. */
const BUSINESS_FIELDS = ["name", "description", "priceLevel"] as const;
const CONTACT_FIELDS = [
  "phone",
  "phoneSecondary",
  "email",
  "website",
  "facebookUrl",
  "instagramUrl",
] as const;
const LOCATION_FIELDS = [
  "addressText",
  "district",
  "khoroo",
  "latitude",
  "longitude",
] as const;

export type SuggestionPayload = Record<string, unknown>;

/** Record a pending edit suggestion. */
export async function createSuggestion(
  businessId: string,
  userId: string | null,
  payload: SuggestionPayload,
): Promise<EditSuggestion> {
  const biz = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: { id: true },
  });
  if (!biz) throw new SuggestionError("Бизнес олдсонгүй", 404);

  const [row] = await db
    .insert(businessEditSuggestions)
    .values({ businessId, userId, payload, status: "PENDING" })
    .returning();
  return row!;
}

export type AdminSuggestionRow = EditSuggestion & {
  business: { id: string; name: string; slug: string; manuallyVerified: boolean } | null;
  user: { id: string; name: string | null } | null;
};

export type ListSuggestionsForAdminParams = {
  status?: SuggestionStatus;
  page?: number;
  pageSize?: number;
};

/** Paginated admin suggestion queue (newest first). */
export async function listSuggestionsForAdmin(
  params: ListSuggestionsForAdminParams,
): Promise<{ items: AdminSuggestionRow[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  const conds = [sql`1 = 1`];
  if (params.status) conds.push(sql`s.status = ${params.status}`);
  const whereSql = sql.join(conds, sql` AND `);

  const rows = (await db.execute(sql`
    SELECT
      s.id, s.business_id, s.user_id, s.payload, s.status,
      s.reviewed_by, s.reviewed_at, s.created_at,
      b.id AS b_id, b.name AS b_name, b.slug AS b_slug, b.manually_verified AS b_mv,
      u.id AS u_id, u.name AS u_name,
      COUNT(*) OVER() AS total
    FROM business_edit_suggestions s
    LEFT JOIN businesses b ON b.id = s.business_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE ${whereSql}
    ORDER BY s.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `)) as unknown as Array<Record<string, unknown>>;

  const total = rows.length > 0 ? Number(rows[0]!.total) : 0;
  const items: AdminSuggestionRow[] = rows.map((r) => ({
    id: r.id as string,
    businessId: r.business_id as string,
    userId: (r.user_id as string) ?? null,
    payload: r.payload as unknown,
    status: r.status as SuggestionStatus,
    reviewedBy: (r.reviewed_by as string) ?? null,
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at as string) : null,
    createdAt: new Date(r.created_at as string),
    business: r.b_id
      ? {
          id: r.b_id as string,
          name: r.b_name as string,
          slug: r.b_slug as string,
          manuallyVerified: Boolean(r.b_mv),
        }
      : null,
    user: r.u_id ? { id: r.u_id as string, name: (r.u_name as string) ?? null } : null,
  }));

  return { items, total };
}

/**
 * Approve or reject a suggestion. On approval, apply the allowed fields to the
 * business / contact / location rows in a transaction — but if the business is
 * `manuallyVerified`, the apply step is skipped (status is still recorded so the
 * queue clears, with the understanding that verified data is protected).
 */
export async function decideSuggestion(
  id: string,
  moderatorId: string,
  decision: SuggestionDecision,
): Promise<{ suggestion: EditSuggestion; applied: boolean }> {
  const suggestion = await db.query.businessEditSuggestions.findFirst({
    where: eq(businessEditSuggestions.id, id),
  });
  if (!suggestion) throw new SuggestionError("Санал олдсонгүй", 404);
  if (suggestion.status !== "PENDING") {
    throw new SuggestionError("Энэ саналыг аль хэдийн шийдвэрлэсэн байна", 409);
  }

  const biz = await db.query.businesses.findFirst({
    where: eq(businesses.id, suggestion.businessId),
    columns: { id: true, manuallyVerified: true },
  });

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(businessEditSuggestions)
      .set({ status: decision, reviewedBy: moderatorId, reviewedAt: new Date() })
      .where(eq(businessEditSuggestions.id, id))
      .returning();

    let applied = false;
    if (decision === "APPROVED" && biz && !biz.manuallyVerified) {
      applied = await applyPayload(tx, suggestion.businessId, suggestion.payload as SuggestionPayload);
    }

    return { suggestion: updated!, applied };
  });
}

/** Apply the allowlisted subset of a payload to the relevant tables. */
async function applyPayload(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  businessId: string,
  payload: SuggestionPayload,
): Promise<boolean> {
  let touched = false;

  const businessPatch = pick(payload, BUSINESS_FIELDS);
  if (Object.keys(businessPatch).length > 0) {
    await tx
      .update(businesses)
      .set({ ...businessPatch, updatedAt: new Date() })
      .where(eq(businesses.id, businessId));
    touched = true;
  }

  const contactPatch = pick(payload, CONTACT_FIELDS);
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
    touched = true;
  }

  const locationPatch = pick(payload, LOCATION_FIELDS);
  if (Object.keys(locationPatch).length > 0) {
    const existing = await tx.query.businessLocations.findFirst({
      where: eq(businessLocations.businessId, businessId),
      columns: { id: true },
    });
    if (existing) {
      await tx
        .update(businessLocations)
        .set({ ...locationPatch, updatedAt: new Date() })
        .where(eq(businessLocations.businessId, businessId));
    } else {
      await tx.insert(businessLocations).values({ businessId, ...locationPatch });
    }
    touched = true;
  }

  return touched;
}

/** Pick only the allowed keys (with a defined value) from a payload. */
function pick<K extends readonly string[]>(
  payload: SuggestionPayload,
  keys: K,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null) {
      out[key] = payload[key];
    }
  }
  return out;
}
