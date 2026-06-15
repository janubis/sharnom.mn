/**
 * Edge-safe Auth.js configuration.
 *
 * Contains ONLY what middleware needs (callbacks, pages, route authorization).
 * No database adapter or Node-only providers here so it can run on the edge.
 * The full config (adapter + providers) lives in `auth.ts`.
 */
import type { NextAuthConfig } from "next-auth";

import type { UserRole } from "@/db/schema";

const ADMIN_ROLES: UserRole[] = ["MODERATOR", "ADMIN", "SUPER_ADMIN"];
const OWNER_ROLES: UserRole[] = ["OWNER", "ADMIN", "SUPER_ADMIN"];

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [], // populated in auth.ts (Node runtime)
  callbacks: {
    /**
     * Route protection used by middleware.
     * Returning false / a redirect blocks access.
     */
    authorized({ auth, request: { nextUrl } }) {
      const role = (auth?.user?.role ?? "USER") as UserRole;
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      if (path.startsWith("/admin")) {
        return isLoggedIn && ADMIN_ROLES.includes(role);
      }
      if (path.startsWith("/owner")) {
        return isLoggedIn && OWNER_ROLES.includes(role);
      }
      if (
        path.startsWith("/profile") ||
        path.startsWith("/saved") ||
        path.startsWith("/settings")
      ) {
        return isLoggedIn;
      }
      return true;
    },
    /** Surface id + role from the JWT into the session (edge + node). */
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? token.id) as string;
        session.user.role = (token.role ?? "USER") as UserRole;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
