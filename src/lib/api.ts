/**
 * Helpers for Next.js Route Handlers: uniform JSON responses, error mapping
 * (Zod → 422, AuthError → 401/403), anonymous session id, and client IP.
 */
import "server-only";

import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError } from "@/lib/rbac";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** Wrap a handler body; converts thrown errors into JSON responses. */
export function handleError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return fail("Оролтын мэдээлэл буруу байна", 422, {
      issues: error.flatten().fieldErrors,
    });
  }
  if (error instanceof AuthError) {
    return fail(error.message, error.status);
  }
  console.error("[api] unhandled error:", error);
  return fail("Серверийн алдаа гарлаа", 500);
}

/** Stable anonymous session id (for analytics) stored in an httpOnly cookie. */
export async function getSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get("ml_sid")?.value;
  if (existing) return existing;
  const sid = crypto.randomUUID();
  try {
    store.set("ml_sid", sid, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  } catch {
    /* called from a context where cookies are read-only — ignore */
  }
  return sid;
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "0.0.0.0";
}

/** Parse URLSearchParams into a plain object for Zod parsing. */
export function searchParamsToObject(url: string): Record<string, string> {
  const { searchParams } = new URL(url);
  return Object.fromEntries(searchParams.entries());
}
