/**
 * User profile + admin user-management queries and the audit-log writer.
 */
import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, reviews, users } from "@/db/schema";
import type { Review, User, UserRole } from "@/db/schema";
import { PAGE_SIZE } from "@/lib/constants";

export type RecentReview = Review & {
  business: { id: string; name: string; slug: string } | null;
};

export type UserProfile = {
  user: User;
  reviewCount: number;
  photoCount: number;
  savedCount: number;
  recentReviews: RecentReview[];
};

/** Public/own profile: user record + live contribution counts + recent reviews. */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;

  const [counts] = (await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM reviews r
        WHERE r.user_id = ${userId} AND r.status = 'PUBLISHED')::int AS review_count,
      (SELECT COUNT(*) FROM review_photos rp
        WHERE rp.user_id = ${userId} AND rp.status = 'APPROVED')::int AS photo_count,
      (SELECT COUNT(*) FROM saved_businesses sb
        WHERE sb.user_id = ${userId})::int AS saved_count
  `)) as unknown as Array<{
    review_count: number;
    photo_count: number;
    saved_count: number;
  }>;

  const recentReviews = (await db.query.reviews.findMany({
    where: and(eq(reviews.userId, userId), eq(reviews.status, "PUBLISHED")),
    orderBy: [desc(reviews.createdAt)],
    limit: 10,
    with: {
      business: { columns: { id: true, name: true, slug: true } },
    },
  })) as unknown as RecentReview[];

  return {
    user,
    reviewCount: counts ? Number(counts.review_count) : 0,
    photoCount: counts ? Number(counts.photo_count) : 0,
    savedCount: counts ? Number(counts.saved_count) : 0,
    recentReviews,
  };
}

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: UserRole;
  reviewCount: number;
  bannedAt: Date | null;
  suspendedUntil: Date | null;
  createdAt: Date;
};

export type ListUsersForAdminParams = {
  q?: string;
  role?: UserRole;
  page?: number;
  pageSize?: number;
};

/** Paginated, filtered admin user table. */
export async function listUsersForAdmin(
  params: ListUsersForAdminParams,
): Promise<{ items: AdminUserRow[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  const conds = [sql`1 = 1`];
  if (params.q && params.q.trim()) {
    const q = params.q.trim();
    conds.push(sql`(u.name ILIKE ${"%" + q + "%"} OR u.email ILIKE ${"%" + q + "%"})`);
  }
  if (params.role) conds.push(sql`u.role = ${params.role}`);
  const whereSql = sql.join(conds, sql` AND `);

  const rows = (await db.execute(sql`
    SELECT
      u.id, u.name, u.email, u.image, u.role, u.review_count,
      u.banned_at, u.suspended_until, u.created_at,
      COUNT(*) OVER() AS total
    FROM users u
    WHERE ${whereSql}
    ORDER BY u.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `)) as unknown as Array<{
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    role: UserRole;
    review_count: number;
    banned_at: string | null;
    suspended_until: string | null;
    created_at: string;
    total: number;
  }>;

  const total = rows.length > 0 ? Number(rows[0]!.total) : 0;
  const items: AdminUserRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    image: r.image,
    role: r.role,
    reviewCount: Number(r.review_count),
    bannedAt: r.banned_at ? new Date(r.banned_at) : null,
    suspendedUntil: r.suspended_until ? new Date(r.suspended_until) : null,
    createdAt: new Date(r.created_at),
  }));

  return { items, total };
}

/** Update a user's role. */
export async function setUserRole(userId: string, role: UserRole): Promise<User> {
  const [updated] = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated!;
}

/**
 * Ban (permanent) or suspend (until a date) a user. Passing `until` suspends;
 * omitting it (or `permanent: true`) sets a permanent ban. Passing both null
 * lifts the restriction.
 */
export async function banUser(
  userId: string,
  options: { until?: Date | null; permanent?: boolean } = {},
): Promise<User> {
  const permanent = options.permanent ?? options.until === undefined;
  const [updated] = await db
    .update(users)
    .set({
      bannedAt: permanent ? new Date() : null,
      suspendedUntil: permanent ? null : (options.until ?? null),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return updated!;
}

/** Lift any ban/suspension on a user. */
export async function unbanUser(userId: string): Promise<User> {
  const [updated] = await db
    .update(users)
    .set({ bannedAt: null, suspendedUntil: null, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated!;
}

/**
 * Append an immutable audit-log entry for a privileged action. Best-effort:
 * never throws into the caller's critical path.
 */
export async function auditLog(
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  before?: unknown,
  after?: unknown,
  ip?: string | null,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorUserId: actorId,
      action,
      targetType,
      targetId,
      before: before === undefined ? null : (before as object),
      after: after === undefined ? null : (after as object),
      ip: ip ?? null,
    });
  } catch {
    /* audit logging must never break the primary action */
  }
}

/** Whether a user is currently restricted (banned or actively suspended). */
export function isRestricted(user: Pick<User, "bannedAt" | "suspendedUntil">): boolean {
  if (user.bannedAt) return true;
  if (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) return true;
  return false;
}
