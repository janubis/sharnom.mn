/**
 * Business-claim flow: an unverified business is "claimed" by a user, then a
 * moderator approves/rejects. Approval wires up ownership and elevates the
 * claimant to OWNER. All decisions run in a transaction.
 */
import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { businessClaims, businesses, claimStatusEnum, users } from "@/db/schema";
import type { BusinessClaim } from "@/db/schema";
import { PAGE_SIZE } from "@/lib/constants";

export type ClaimStatus = (typeof claimStatusEnum.enumValues)[number];
type ClaimDecision = "APPROVED" | "REJECTED";

export class ClaimError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "ClaimError";
  }
}

export type CreateClaimInput = {
  verificationMethod?: "PHONE" | "EMAIL" | "DOCUMENT" | "MANUAL";
  contactPhone?: string | null;
  evidenceUrl?: string | null;
  note?: string | null;
};

/**
 * Create a pending claim. Rejects if the business is already owned or the user
 * already has an open claim on it.
 */
export async function createClaim(
  businessId: string,
  userId: string,
  input: CreateClaimInput,
): Promise<BusinessClaim> {
  const biz = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: { id: true, ownerUserId: true },
  });
  if (!biz) throw new ClaimError("Бизнес олдсонгүй", 404);
  if (biz.ownerUserId) {
    throw new ClaimError("Энэ бизнес аль хэдийн эзэнтэй болсон байна", 409);
  }

  const pending = await db.query.businessClaims.findFirst({
    where: and(
      eq(businessClaims.businessId, businessId),
      eq(businessClaims.userId, userId),
      eq(businessClaims.status, "PENDING"),
    ),
    columns: { id: true },
  });
  if (pending) {
    throw new ClaimError("Таны нэхэмжлэл хүлээгдэж байна", 409);
  }

  const [claim] = await db
    .insert(businessClaims)
    .values({
      businessId,
      userId,
      status: "PENDING",
      verificationMethod: input.verificationMethod ?? null,
      contactPhone: input.contactPhone ?? null,
      evidenceUrl: input.evidenceUrl ?? null,
      note: input.note ?? null,
    })
    .returning();

  return claim!;
}

export type AdminClaimRow = BusinessClaim & {
  business: { id: string; name: string; slug: string } | null;
  user: { id: string; name: string | null; email: string; image: string | null } | null;
};

export type ListClaimsForAdminParams = {
  status?: ClaimStatus;
  page?: number;
  pageSize?: number;
};

/** Paginated admin claim queue (newest first). */
export async function listClaimsForAdmin(
  params: ListClaimsForAdminParams,
): Promise<{ items: AdminClaimRow[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  const conds = [sql`1 = 1`];
  if (params.status) conds.push(sql`c.status = ${params.status}`);
  const whereSql = sql.join(conds, sql` AND `);

  const rows = (await db.execute(sql`
    SELECT
      c.id, c.business_id, c.user_id, c.status, c.verification_method,
      c.evidence_url, c.contact_phone, c.note, c.admin_note,
      c.reviewed_by, c.reviewed_at, c.created_at, c.updated_at,
      b.id AS b_id, b.name AS b_name, b.slug AS b_slug,
      u.id AS u_id, u.name AS u_name, u.email AS u_email, u.image AS u_image,
      COUNT(*) OVER() AS total
    FROM business_claims c
    LEFT JOIN businesses b ON b.id = c.business_id
    LEFT JOIN users u ON u.id = c.user_id
    WHERE ${whereSql}
    ORDER BY c.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `)) as unknown as Array<Record<string, unknown>>;

  const total = rows.length > 0 ? Number(rows[0]!.total) : 0;
  const items: AdminClaimRow[] = rows.map((r) => ({
    id: r.id as string,
    businessId: r.business_id as string,
    userId: r.user_id as string,
    status: r.status as ClaimStatus,
    verificationMethod: (r.verification_method as BusinessClaim["verificationMethod"]) ?? null,
    evidenceUrl: (r.evidence_url as string) ?? null,
    contactPhone: (r.contact_phone as string) ?? null,
    note: (r.note as string) ?? null,
    adminNote: (r.admin_note as string) ?? null,
    reviewedBy: (r.reviewed_by as string) ?? null,
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at as string) : null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
    business: r.b_id
      ? { id: r.b_id as string, name: r.b_name as string, slug: r.b_slug as string }
      : null,
    user: r.u_id
      ? {
          id: r.u_id as string,
          name: (r.u_name as string) ?? null,
          email: r.u_email as string,
          image: (r.u_image as string) ?? null,
        }
      : null,
  }));

  return { items, total };
}

/**
 * Approve or reject a claim. On approval (in a transaction): set the business
 * owner + verification CLAIMED, and elevate the claimant to OWNER if they are a
 * plain USER. Idempotent against already-decided claims.
 */
export async function decideClaim(
  claimId: string,
  moderatorId: string,
  decision: ClaimDecision,
  adminNote?: string | null,
): Promise<BusinessClaim> {
  const claim = await db.query.businessClaims.findFirst({
    where: eq(businessClaims.id, claimId),
  });
  if (!claim) throw new ClaimError("Нэхэмжлэл олдсонгүй", 404);
  if (claim.status !== "PENDING") {
    throw new ClaimError("Энэ нэхэмжлэлийг аль хэдийн шийдвэрлэсэн байна", 409);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(businessClaims)
      .set({
        status: decision,
        adminNote: adminNote ?? null,
        reviewedBy: moderatorId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(businessClaims.id, claimId))
      .returning();

    if (decision === "APPROVED") {
      await tx
        .update(businesses)
        .set({
          ownerUserId: claim.userId,
          verificationStatus: "CLAIMED",
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, claim.businessId));

      // Elevate the claimant to OWNER only if they're currently a plain USER.
      await tx
        .update(users)
        .set({ role: "OWNER", updatedAt: new Date() })
        .where(and(eq(users.id, claim.userId), eq(users.role, "USER")));
    }

    return updated!;
  });
}

/** A user's own claims (for the profile / claim-status page). */
export async function listUserClaims(userId: string): Promise<BusinessClaim[]> {
  return db.query.businessClaims.findMany({
    where: eq(businessClaims.userId, userId),
    orderBy: [desc(businessClaims.createdAt)],
  });
}
