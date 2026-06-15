/**
 * Role-based access control helpers.
 * Used by API route handlers and server actions to gate privileged actions.
 */
import { getCurrentUser } from "@/lib/auth";
import type { UserRole } from "@/db/schema";

const RANK: Record<UserRole, number> = {
  USER: 0,
  OWNER: 1,
  MODERATOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function hasRole(role: UserRole | undefined, min: UserRole): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

export const isModerator = (r?: UserRole) => hasRole(r, "MODERATOR");
export const isAdmin = (r?: UserRole) => hasRole(r, "ADMIN");
export const isOwnerRole = (r?: UserRole) => hasRole(r, "OWNER");

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
