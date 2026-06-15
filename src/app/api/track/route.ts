/**
 * POST /api/track — fire-and-forget analytics ingestion.
 *
 * Accepts a known event name (+ optional context) and records it via track().
 * Always returns 200 so the client beacon never blocks or surfaces errors; an
 * unknown event simply records nothing.
 */
import "server-only";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getSessionId, ok } from "@/lib/api";
import { ANALYTICS_EVENTS } from "@/lib/constants";
import { trackAsync } from "@/lib/analytics/track";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  event: z.enum(ANALYTICS_EVENTS),
  businessId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  district: z.string().max(80).optional(),
  query: z.string().max(200).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return ok({ accepted: false });

    const [sessionId, user] = await Promise.all([
      getSessionId(),
      getCurrentUser(),
    ]);

    const e = parsed.data;
    trackAsync({
      event: e.event,
      userId: user?.id ?? null,
      sessionId,
      businessId: e.businessId ?? null,
      categoryId: e.categoryId ?? null,
      district: e.district ?? null,
      query: e.query ?? null,
      lat: e.lat ?? null,
      lng: e.lng ?? null,
      metadata: e.metadata,
    });

    return ok({ accepted: true });
  } catch {
    // Tracking must never fail a request.
    return ok({ accepted: false });
  }
}
