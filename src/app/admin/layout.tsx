/**
 * Admin console layout — server-protected (MODERATOR and above).
 *
 * Middleware already gates /admin, but we re-check here so that direct server
 * renders and role downgrades are enforced too. Pending-queue counts feed the
 * sidebar badges.
 */
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import type { UserRole } from "@/db/schema";
import { AdminShell } from "./_components/admin-shell";

export const dynamic = "force-dynamic";

async function getPendingBadges() {
  try {
    const [row] = (await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM business_claims WHERE status = 'PENDING')::int AS claims,
        (SELECT COUNT(*) FROM reports WHERE status = 'OPEN')::int AS reports,
        (SELECT COUNT(*) FROM reviews WHERE status = 'PENDING')::int AS reviews,
        (
          (SELECT COUNT(*) FROM business_photos WHERE status = 'PENDING')
          + (SELECT COUNT(*) FROM review_photos WHERE status = 'PENDING')
        )::int AS photos
    `)) as unknown as Array<{
      claims: number;
      reports: number;
      reviews: number;
      photos: number;
    }>;
    return {
      claims: Number(row?.claims ?? 0),
      reports: Number(row?.reports ?? 0),
      reviews: Number(row?.reviews ?? 0),
      photos: Number(row?.photos ?? 0),
    };
  } catch {
    return undefined;
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user;

  if (!user) redirect("/login?callbackUrl=/admin");
  if (!hasRole(user.role as UserRole, "MODERATOR")) redirect("/");

  const badges = await getPendingBadges();

  return (
    <AdminShell
      user={{
        name: user.name ?? null,
        email: user.email ?? null,
        image: user.image ?? null,
        role: user.role as UserRole,
      }}
      badges={badges}
    >
      {children}
    </AdminShell>
  );
}
