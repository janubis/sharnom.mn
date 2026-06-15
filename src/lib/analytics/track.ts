/**
 * Unified analytics event tracking.
 *
 * Writes to ClickHouse when ANALYTICS_SINK=clickhouse, otherwise to the
 * Postgres `analytics_events` fallback table. Fire-and-forget: tracking must
 * never block or fail a user request.
 */
import "server-only";

import { db } from "@/db";
import { analyticsEvents, searchQueries } from "@/db/schema";
import { insertEvents } from "@/lib/analytics/clickhouse";
import type { AnalyticsEventName } from "@/lib/constants";
import { env } from "@/lib/env";
import { normalizeBusinessName } from "@/lib/normalize";

export type TrackPayload = {
  event: AnalyticsEventName;
  userId?: string | null;
  sessionId?: string | null;
  businessId?: string | null;
  categoryId?: string | null;
  district?: string | null;
  query?: string | null;
  lat?: number | null;
  lng?: number | null;
  metadata?: Record<string, unknown>;
};

export async function track(payload: TrackPayload): Promise<void> {
  try {
    if (env.ANALYTICS_SINK === "clickhouse") {
      await insertEvents([
        {
          event_name: payload.event,
          user_id: payload.userId ?? "",
          session_id: payload.sessionId ?? "",
          business_id: payload.businessId ?? "",
          category_id: payload.categoryId ?? "",
          district: payload.district ?? "",
          query: payload.query ?? "",
          lat: payload.lat ?? 0,
          lng: payload.lng ?? 0,
          metadata: JSON.stringify(payload.metadata ?? {}),
        },
      ]);
    } else {
      await db.insert(analyticsEvents).values({
        eventName: payload.event,
        userId: payload.userId ?? null,
        sessionId: payload.sessionId ?? null,
        businessId: payload.businessId ?? null,
        categoryId: payload.categoryId ?? null,
        district: payload.district ?? null,
        query: payload.query ?? null,
        metadata: payload.metadata ?? null,
      });
    }
  } catch (e) {
    if (env.NODE_ENV === "development") {
      console.warn("[analytics] track failed:", (e as Error).message);
    }
  }
}

/** Convenience wrapper for search logging (also feeds "top keywords"). */
export async function trackSearch(
  query: string,
  resultsCount: number,
  userId?: string | null,
): Promise<void> {
  const q = query.trim();
  if (!q) return;
  try {
    await db.insert(searchQueries).values({
      queryRaw: q,
      queryNormalized: normalizeBusinessName(q),
      resultsCount,
      userId: userId ?? null,
    });
  } catch {
    /* non-fatal */
  }
  void track({ event: "search_performed", query: q, userId, metadata: { resultsCount } });
}

/** Fire-and-forget helper for use inside request handlers. */
export function trackAsync(payload: TrackPayload): void {
  void track(payload);
}
