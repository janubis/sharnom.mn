/**
 * Admin dashboard analytics. All series read from the Postgres analytics_events
 * / search_queries fallback tables (the same sink track() writes to when
 * ANALYTICS_SINK != clickhouse), plus live counts from the domain tables.
 */
import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/* ──────────────────────────────── KPIs ───────────────────────────────────── */

export type AdminKpis = {
  totalBusinesses: number;
  totalUsers: number;
  totalReviews: number;
  totalPhotos: number;
  newBusinessesToday: number;
  newReviewsToday: number;
  pendingClaims: number;
  pendingReports: number;
};

/** Headline counters for the admin overview cards. */
export async function getAdminKpis(): Promise<AdminKpis> {
  const [row] = (await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM businesses WHERE status <> 'DELETED')::int AS total_businesses,
      (SELECT COUNT(*) FROM users)::int AS total_users,
      (SELECT COUNT(*) FROM reviews WHERE status = 'PUBLISHED')::int AS total_reviews,
      (SELECT COUNT(*) FROM business_photos WHERE status = 'APPROVED')::int AS total_photos,
      (SELECT COUNT(*) FROM businesses
        WHERE created_at >= date_trunc('day', now()))::int AS new_businesses_today,
      (SELECT COUNT(*) FROM reviews
        WHERE status = 'PUBLISHED' AND created_at >= date_trunc('day', now()))::int AS new_reviews_today,
      (SELECT COUNT(*) FROM business_claims WHERE status = 'PENDING')::int AS pending_claims,
      (SELECT COUNT(*) FROM reports WHERE status = 'OPEN')::int AS pending_reports
  `)) as unknown as Array<Record<string, number>>;

  return {
    totalBusinesses: Number(row?.total_businesses ?? 0),
    totalUsers: Number(row?.total_users ?? 0),
    totalReviews: Number(row?.total_reviews ?? 0),
    totalPhotos: Number(row?.total_photos ?? 0),
    newBusinessesToday: Number(row?.new_businesses_today ?? 0),
    newReviewsToday: Number(row?.new_reviews_today ?? 0),
    pendingClaims: Number(row?.pending_claims ?? 0),
    pendingReports: Number(row?.pending_reports ?? 0),
  };
}

/* ──────────────────────────── Traffic series ─────────────────────────────── */

export type TrafficPoint = { date: string; pageViews: number; searches: number };

/**
 * Daily page_view + search_performed counts over the last `days`, gap-filled so
 * the chart has one point per day.
 */
export async function getTrafficSeries(days = 30): Promise<TrafficPoint[]> {
  const rows = (await db.execute(sql`
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', now()) - (${days - 1} || ' days')::interval,
        date_trunc('day', now()),
        '1 day'
      )::date AS day
    )
    SELECT
      d.day::text AS date,
      COALESCE(SUM(CASE WHEN e.event_name = 'page_view' THEN 1 ELSE 0 END), 0)::int AS page_views,
      COALESCE(SUM(CASE WHEN e.event_name = 'search_performed' THEN 1 ELSE 0 END), 0)::int AS searches
    FROM days d
    LEFT JOIN analytics_events e
      ON date_trunc('day', e.created_at)::date = d.day
    GROUP BY d.day
    ORDER BY d.day ASC
  `)) as unknown as Array<{ date: string; page_views: number; searches: number }>;

  return rows.map((r) => ({
    date: r.date,
    pageViews: Number(r.page_views),
    searches: Number(r.searches),
  }));
}

/* ─────────────────────────── Top search terms ────────────────────────────── */

export type TopSearch = { query: string; count: number; avgResults: number };

/** Most frequent normalised search terms over the window. */
export async function getTopSearches(limit = 20, days = 30): Promise<TopSearch[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = (await db.execute(sql`
    SELECT
      query_normalized AS query,
      COUNT(*)::int AS count,
      COALESCE(AVG(results_count), 0) AS avg_results
    FROM search_queries
    WHERE created_at >= ${since} AND length(trim(query_normalized)) > 0
    GROUP BY query_normalized
    ORDER BY count DESC
    LIMIT ${limit}
  `)) as unknown as Array<{ query: string; count: number; avg_results: number }>;

  return rows.map((r) => ({
    query: r.query,
    count: Number(r.count),
    avgResults: Math.round(Number(r.avg_results) * 10) / 10,
  }));
}

/* ───────────────────────── Top categories / districts ────────────────────── */

export type TopCategory = {
  id: string;
  nameMn: string;
  slug: string;
  icon: string | null;
  businessCount: number;
};

/** Categories with the most ACTIVE businesses. */
export async function getTopCategories(limit = 10): Promise<TopCategory[]> {
  const rows = (await db.execute(sql`
    SELECT c.id, c.name_mn, c.slug, c.icon, COUNT(b.id)::int AS business_count
    FROM categories c
    JOIN businesses b ON b.primary_category_id = c.id AND b.status = 'ACTIVE'
    GROUP BY c.id
    ORDER BY business_count DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    id: string;
    name_mn: string;
    slug: string;
    icon: string | null;
    business_count: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    nameMn: r.name_mn,
    slug: r.slug,
    icon: r.icon,
    businessCount: Number(r.business_count),
  }));
}

export type TopDistrict = { district: string; businessCount: number };

/** Districts with the most ACTIVE businesses. */
export async function getTopDistricts(limit = 10): Promise<TopDistrict[]> {
  const rows = (await db.execute(sql`
    SELECT loc.district, COUNT(*)::int AS business_count
    FROM businesses b
    JOIN business_locations loc ON loc.business_id = b.id
    WHERE b.status = 'ACTIVE' AND loc.district IS NOT NULL
    GROUP BY loc.district
    ORDER BY business_count DESC
    LIMIT ${limit}
  `)) as unknown as Array<{ district: string; business_count: number }>;

  return rows.map((r) => ({ district: r.district, businessCount: Number(r.business_count) }));
}

/* ─────────────────────── Most viewed / reviewed lists ─────────────────────── */

export type BusinessLeader = {
  id: string;
  name: string;
  slug: string;
  value: number;
  ratingAvg: number;
};

/** Top businesses by all-time view_count. */
export async function getMostViewedBusinesses(limit = 10): Promise<BusinessLeader[]> {
  const rows = (await db.execute(sql`
    SELECT id, name, slug, view_count AS value, rating_avg
    FROM businesses
    WHERE status = 'ACTIVE'
    ORDER BY view_count DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    value: number;
    rating_avg: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    value: Number(r.value),
    ratingAvg: Number(r.rating_avg),
  }));
}

/** Top businesses by review_count. */
export async function getMostReviewedBusinesses(limit = 10): Promise<BusinessLeader[]> {
  const rows = (await db.execute(sql`
    SELECT id, name, slug, review_count AS value, rating_avg
    FROM businesses
    WHERE status = 'ACTIVE'
    ORDER BY review_count DESC, rating_avg DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    value: number;
    rating_avg: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    value: Number(r.value),
    ratingAvg: Number(r.rating_avg),
  }));
}

/* ───────────────────────── Map interaction series ────────────────────────── */

export type MapInteractionPoint = {
  date: string;
  pinClicks: number;
  directionClicks: number;
  phoneClicks: number;
};

/** Daily map_pin_clicked / direction_clicked / phone_clicked over `days`. */
export async function getMapInteractionSeries(
  days = 30,
): Promise<MapInteractionPoint[]> {
  const rows = (await db.execute(sql`
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', now()) - (${days - 1} || ' days')::interval,
        date_trunc('day', now()),
        '1 day'
      )::date AS day
    )
    SELECT
      d.day::text AS date,
      COALESCE(SUM(CASE WHEN e.event_name = 'map_pin_clicked' THEN 1 ELSE 0 END), 0)::int AS pin_clicks,
      COALESCE(SUM(CASE WHEN e.event_name = 'direction_clicked' THEN 1 ELSE 0 END), 0)::int AS direction_clicks,
      COALESCE(SUM(CASE WHEN e.event_name = 'phone_clicked' THEN 1 ELSE 0 END), 0)::int AS phone_clicks
    FROM days d
    LEFT JOIN analytics_events e
      ON date_trunc('day', e.created_at)::date = d.day
    GROUP BY d.day
    ORDER BY d.day ASC
  `)) as unknown as Array<{
    date: string;
    pin_clicks: number;
    direction_clicks: number;
    phone_clicks: number;
  }>;

  return rows.map((r) => ({
    date: r.date,
    pinClicks: Number(r.pin_clicks),
    directionClicks: Number(r.direction_clicks),
    phoneClicks: Number(r.phone_clicks),
  }));
}

/* ─────────────────────────── Active users ────────────────────────────────── */

export type ActiveUsers = { dau: number; wau: number; mau: number };

/** Distinct active users in the last 1 / 7 / 30 days (from analytics_events). */
export async function getActiveUsers(): Promise<ActiveUsers> {
  const [row] = (await db.execute(sql`
    SELECT
      COUNT(DISTINCT user_id) FILTER (
        WHERE created_at >= now() - interval '1 day' AND user_id IS NOT NULL
      )::int AS dau,
      COUNT(DISTINCT user_id) FILTER (
        WHERE created_at >= now() - interval '7 days' AND user_id IS NOT NULL
      )::int AS wau,
      COUNT(DISTINCT user_id) FILTER (
        WHERE created_at >= now() - interval '30 days' AND user_id IS NOT NULL
      )::int AS mau
    FROM analytics_events
  `)) as unknown as Array<{ dau: number; wau: number; mau: number }>;

  return {
    dau: Number(row?.dau ?? 0),
    wau: Number(row?.wau ?? 0),
    mau: Number(row?.mau ?? 0),
  };
}

/**
 * Convenience aggregate for the analytics page — bundles the common series so a
 * route can fetch everything for a `range` in one call.
 */
export async function getAnalyticsBundle(days = 30) {
  const [traffic, mapInteractions, topSearches, topCategories, topDistricts, activeUsers] =
    await Promise.all([
      getTrafficSeries(days),
      getMapInteractionSeries(days),
      getTopSearches(20, days),
      getTopCategories(10),
      getTopDistricts(10),
      getActiveUsers(),
    ]);

  return { traffic, mapInteractions, topSearches, topCategories, topDistricts, activeUsers };
}
