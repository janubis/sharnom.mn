/**
 * Full Auth.js (NextAuth v5) setup — Node runtime.
 *
 * Strategy: JWT sessions (edge-compatible middleware) + Drizzle adapter for
 * persisting users & linked OAuth accounts. Providers are enabled dynamically
 * based on which credentials are present in the environment.
 */
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Apple from "next-auth/providers/apple";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";

import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { authConfig } from "@/lib/auth.config";
import { env } from "@/lib/env";

function buildProviders(): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [];

  if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET }),
    );
  }
  if (env.AUTH_FACEBOOK_ID && env.AUTH_FACEBOOK_SECRET) {
    providers.push(
      Facebook({ clientId: env.AUTH_FACEBOOK_ID, clientSecret: env.AUTH_FACEBOOK_SECRET }),
    );
  }
  if (env.AUTH_APPLE_ID && env.AUTH_APPLE_SECRET) {
    providers.push(
      Apple({ clientId: env.AUTH_APPLE_ID, clientSecret: env.AUTH_APPLE_SECRET }),
    );
  }
  if (env.AUTH_EMAIL_SERVER) {
    providers.push(
      Nodemailer({ server: env.AUTH_EMAIL_SERVER, from: env.AUTH_EMAIL_FROM }),
    );
  }
  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  secret: env.AUTH_SECRET,
  providers: buildProviders(),
  callbacks: {
    ...authConfig.callbacks,
    /** Enrich the JWT with id + role at sign-in (DB-backed). */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // The adapter returns our full user row including `role`.
        token.role = (user as { role?: string }).role ?? "USER";
      }
      return token;
    },
  },
});

/** Convenience: the current authenticated user (or null). */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}
