/**
 * Pure, client-safe role helpers (no auth/db imports).
 *
 * These can be imported from BOTH client and server components. The server-only
 * guards (requireUser/requireRole) live in `@/lib/rbac`, which must never be
 * imported into a client bundle (it pulls in Auth.js → nodemailer → `fs`).
 */
import type { UserRole } from "@/db/schema";

export const ROLE_RANK: Record<UserRole, number> = {
  USER: 0,
  OWNER: 1,
  MODERATOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function hasRole(role: UserRole | undefined, min: UserRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const isModerator = (r?: UserRole) => hasRole(r, "MODERATOR");
export const isAdmin = (r?: UserRole) => hasRole(r, "ADMIN");
export const isOwnerRole = (r?: UserRole) => hasRole(r, "OWNER");
