/**
 * Client instrumentation. Sentry initialises ONLY when NEXT_PUBLIC_SENTRY_DSN is set
 * (inert until you connect a Sentry project).
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

// Instruments App Router client-side navigations (no-op when Sentry isn't initialised).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
