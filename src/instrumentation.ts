/**
 * Server/edge instrumentation. Sentry initialises ONLY when NEXT_PUBLIC_SENTRY_DSN
 * is set, so this is completely inert until you connect a Sentry project.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  });
}

// Captures errors thrown in server components / route handlers (Next 15+ hook).
export const onRequestError = Sentry.captureRequestError;
