/**
 * Server-only role-based access control guards.
 * Used by API route handlers and server actions to gate privileged actions.
 *
 * Importing this module pulls in Auth.js (→ nodemailer → `fs`), so it is marked
 * server-only. Client components must import the PURE helpers from `@/lib/roles`.
 */
import "server-only";

import { getCurrentUser } from "@/lib/auth";
import type { UserRole } from "@/db/schema";

// Re-export the pure, client-safe helpers so existing server imports keep working.
export { ROLE_RANK, hasRole, isModerator, isAdmin, isOwnerRole } from "@/lib/roles";
import { hasRole } from "@/lib/roles";

/** Thrown by guards; API handlers map this to a 401/403 response. */
export class AuthError extends Error {
  constructor(
    message: string,
    public status: 401 | 403 = 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Require an authenticated user. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Нэвтрэх шаардлагатай", 401);
  if ((user as { bannedAt?: unknown }).bannedAt) {
    throw new AuthError("Таны эрх хаагдсан байна", 403);
  }
  return user;
}

/** Require at least the given role. */
export async function requireRole(min: UserRole) {
  const user = await requireUser();
  if (!hasRole(user.role, min)) {
    throw new AuthError("Хандах эрх хүрэлцэхгүй байна", 403);
  }
  return user;
}

export const requireAdmin = () => requireRole("ADMIN");
export const requireModerator = () => requireRole("MODERATOR");
