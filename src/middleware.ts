/**
 * Edge middleware: route protection (RBAC) + light i18n passthrough.
 * Uses the edge-safe auth config (no DB / Node deps).
 */
import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

// Next 16 requires a function export (default or named `middleware`); a
// destructured `const` isn't recognized. `auth` is the Auth.js middleware fn.
const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  // Protect app routes; skip static assets, images, and auth/api internals.
  matcher: [
    "/admin/:path*",
    "/owner/:path*",
    "/profile/:path*",
    "/saved/:path*",
    "/settings/:path*",
  ],
};
