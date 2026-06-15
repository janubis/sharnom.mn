/**
 * Owner-dashboard queries: the businesses a user owns and per-business
 * engagement analytics derived from analytics_events + reviews.
 */
import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { businessLocations, businesses } from "@/db/schema";
import type { Business } from "@/db/schema";

export type OwnerBusinessRow = Business & {
  district: string | null;
  addressText: string | null;
};

/** All businesses owned by the user, with location summary, name-ordered. */
export async function listOwnerBusinesses(
  ownerUserId: string,
): Promise<OwnerBusinessRow[]> {
  const rows = await db
    .select({
      business: businesses,
      district: businessLocations.district,
      addressText: businessLocations.addressText,
    })
    .from(businesses)
    .leftJoin(businessLocations, eq(businessLocations.businessId, businesses.id))
    .where(eq(businesses.ownerUserId, ownerUserId))
    .orderBy(asc(businesses.name));

  return rows.map((r) => ({
    ...r.business,
    district: r.district,
    addressText: r.addressText,
  }));
}

export type OwnerBusinessAnalytics = {
  businessId: string;
  range: { days: number; from: string };
  totals: {
    profileViews: number;
    phoneClicks: number;
    directionClicks: number;
    websiteClicks: number;
    mapPinClicks: number;
    saves: number;
  };
  reviewTrend: { date: string; count: number; avgRating: number }[];
  viewSeries: { date: string; views: number }[];
};

const EVENT_TO_KEY: Record<string, keyof OwnerBusinessAnalytics["totals"]> = {
  business_viewed: "profileViews",
  phone_clicked: "phoneClicks",
  direction_clicked: "directionClicks",
  website_clicked: "websiteClicks",
  map_pin_clicked: "mapPinClicks",
  business_saved: "saves",
};

/**
 * Engagement analytics for a single business over the last `days` (default 30):
 * grouped event totals, a daily profile-view series, and a daily review trend.
 */
export async function getOwnerBusinessAnalytics(
  businessId: string,
  days = 30,
): Promise<OwnerBusinessAnalytics> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const totalsRows = (await db.execute(sql`
    SELECT event_name, COUNT(*)::int AS count
    FROM analytics_events
    WHERE business_id = ${businessId}
      AND created_at >= ${since}
    GROUP BY event_name
  `)) as unknown as Array<{ event_name: string; count: number }>;

  const totals: OwnerBusinessAnalytics["totals"] = {
    profileViews: 0,
    phoneClicks: 0,
    directionClicks: 0,
    websiteClicks: 0,
    mapPinClicks: 0,
    saves: 0,
  };
  for (const row of totalsRows) {
    const key = EVENT_TO_KEY[row.event_name];
    if (key) totals[key] = Number(row.count);
  }

  const viewRows = (await db.execute(sql`
    SELECT date_trunc('day', created_at)::date::text AS date, COUNT(*)::int AS views
    FROM analytics_events
    WHERE business_id = ${businessId}
      AND event_name = 'business_viewed'
      AND created_at >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `)) as unknown as Array<{ date: string; views: number }>;

  const reviewRows = (await db.execute(sql`
    SELECT
      date_trunc('day', created_at)::date::text AS date,
      COUNT(*)::int AS count,
      COALESCE(AVG(rating), 0) AS avg_rating
    FROM reviews
    WHERE business_id = ${businessId}
      AND status = 'PUBLISHED'
      AND created_at >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `)) as unknown as Array<{ date: string; count: number; avg_rating: number }>;

  return {
    businessId,
    range: { days, from: since.toISOString() },
    totals,
    viewSeries: viewRows.map((r) => ({ date: r.date, views: Number(r.views) })),
    reviewTrend: reviewRows.map((r) => ({
      date: r.date,
      count: Number(r.count),
      avgRating: Math.round(Number(r.avg_rating) * 100) / 100,
    })),
  };
}
