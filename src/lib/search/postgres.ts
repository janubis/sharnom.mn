/**
 * Stage-1 search: PostgreSQL + PostGIS + pg_trgm.
 *
 * Handles full-text-ish fuzzy name matching, category/district/price/rating
 * filters, "open now" via business_hours, geo-distance, and a weighted
 * "recommended" ranking. Designed to be swapped for OpenSearch (Stage 2)
 * behind the same SearchParams/SearchResult contract.
 */
import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { PAGE_SIZE } from "@/lib/constants";
import type { SearchItem, SearchParams, SearchResult } from "./types";

type Row = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rating_avg: number;
  review_count: number;
  price_level: number | null;
  verified: boolean;
  cat_name: string | null;
  cat_slug: string | null;
  cat_icon: string | null;
  district: string | null;
  address_text: string | null;
  lat: number | null;
  lng: number | null;
  cover_url: string | null;
  phone: string | null;
  distance_m: number | null;
  total: number;
};

export async function searchBusinessesPg(params: SearchParams): Promise<SearchResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, params.pageSize ?? PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  const hasGeo = params.lat != null && params.lng != null;
  // EWKT point for distance maths (only valid when hasGeo).
  const point = hasGeo
    ? sql`ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326)::geography`
    : sql`NULL`;

  const distanceExpr = hasGeo
    ? sql`ST_Distance(loc.geog, ${point})`
    : sql`NULL::float8`;

  // ── WHERE conditions ──────────────────────────────────────────────────
  const conds = [sql`b.status = 'ACTIVE'`];

  if (params.q && params.q.trim()) {
    const q = params.q.trim();
    // Trigram similarity OR substring match (handles Cyrillic well).
    conds.push(
      sql`(b.name % ${q} OR b.name ILIKE ${"%" + q + "%"} OR b.normalized_name % ${q})`,
    );
  }
  if (params.categorySlug) {
    conds.push(
      sql`(cat.slug = ${params.categorySlug} OR parent.slug = ${params.categorySlug})`,
    );
  }
  if (params.district) {
    conds.push(sql`loc.district = ${params.district}`);
  }
  if (params.minRating != null) {
    conds.push(sql`b.rating_avg >= ${params.minRating}`);
  }
  if (params.verifiedOnly) {
    conds.push(sql`b.verification_status = 'VERIFIED'`);
  }
  if (params.priceLevels && params.priceLevels.length > 0) {
    conds.push(sql`b.price_level = ANY(${params.priceLevels})`);
  }
  if (hasGeo && params.radiusKm) {
    conds.push(sql`ST_DWithin(loc.geog, ${point}, ${params.radiusKm * 1000})`);
  }
  if (params.bounds) {
    const { west, south, east, north } = params.bounds;
    conds.push(
      sql`loc.longitude BETWEEN ${west} AND ${east} AND loc.latitude BETWEEN ${south} AND ${north}`,
    );
  }
  if (params.openNow) {
    // Postgres dow: 0=Sun..6=Sat matches our day_of_week convention.
    conds.push(sql`EXISTS (
      SELECT 1 FROM business_hours h
      WHERE h.business_id = b.id
        AND h.is_closed = false
        AND h.day_of_week = EXTRACT(DOW FROM now())::int
        AND h.open_time IS NOT NULL AND h.close_time IS NOT NULL
        AND (now()::time BETWEEN h.open_time AND h.close_time)
    )`);
  }

  const whereSql = sql.join(conds, sql` AND `);

  // ── Relevance (trigram similarity 0..1) ───────────────────────────────
  const relevanceExpr =
    params.q && params.q.trim()
      ? sql`GREATEST(similarity(b.name, ${params.q}), similarity(COALESCE(b.normalized_name,''), ${params.q}))`
      : sql`0::float4`;

  // ── ORDER BY ──────────────────────────────────────────────────────────
  // "recommended" = weighted blend: relevance, rating, popularity, verified,
  // completeness, recency, proximity, minus spam penalty.
  const distanceScore = hasGeo
    ? sql`(1.0 / (1.0 + (${distanceExpr} / 1000.0)))`
    : sql`0`;

  const recommendedScore = sql`(
      ${relevanceExpr} * 3.0
    + (b.rating_avg / 5.0) * 1.5
    + LEAST(b.review_count, 100) / 100.0 * 1.0
    + (CASE WHEN b.verification_status = 'VERIFIED' THEN 0.6 ELSE 0 END)
    + (b.completeness_score / 100.0) * 0.5
    + ${distanceScore} * 1.2
    + (CASE WHEN b.published_at > now() - interval '30 days' THEN 0.3 ELSE 0 END)
  )`;

  let orderSql;
  switch (params.sort) {
    case "rating":
      orderSql = sql`b.rating_avg DESC, b.review_count DESC`;
      break;
    case "reviews":
      orderSql = sql`b.review_count DESC, b.rating_avg DESC`;
      break;
    case "nearest":
      orderSql = hasGeo ? sql`${distanceExpr} ASC NULLS LAST` : sql`b.rating_avg DESC`;
      break;
    case "newest":
      orderSql = sql`b.created_at DESC`;
      break;
    default:
      orderSql = sql`${recommendedScore} DESC, b.review_count DESC`;
  }

  // ── Query ─────────────────────────────────────────────────────────────
  const rows = (await db.execute(sql`
    SELECT
      b.id, b.slug, b.name, b.description,
      b.rating_avg, b.review_count, b.price_level,
      (b.verification_status = 'VERIFIED') AS verified,
      cat.name_mn AS cat_name, cat.slug AS cat_slug, cat.icon AS cat_icon,
      loc.district, loc.address_text,
      loc.latitude AS lat, loc.longitude AS lng,
      ct.phone,
      cover.image_url AS cover_url,
      ${distanceExpr} AS distance_m,
      COUNT(*) OVER() AS total
    FROM businesses b
    LEFT JOIN business_locations loc ON loc.business_id = b.id
    LEFT JOIN business_contacts ct ON ct.business_id = b.id
    LEFT JOIN categories cat ON cat.id = b.primary_category_id
    LEFT JOIN categories parent ON parent.id = cat.parent_id
    LEFT JOIN LATERAL (
      SELECT image_url FROM business_photos p
      WHERE p.business_id = b.id AND p.status = 'APPROVED'
      ORDER BY p.is_cover DESC, p.sort_order ASC
      LIMIT 1
    ) cover ON true
    WHERE ${whereSql}
    ORDER BY ${orderSql}
    LIMIT ${pageSize} OFFSET ${offset}
  `)) as unknown as Row[];

  const total = rows.length > 0 ? Number(rows[0]!.total) : 0;

  const items: SearchItem[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    ratingAvg: Number(r.rating_avg),
    reviewCount: Number(r.review_count),
    priceLevel: r.price_level,
    verified: r.verified,
    category: r.cat_slug
      ? { nameMn: r.cat_name ?? "", slug: r.cat_slug, icon: r.cat_icon }
      : null,
    district: r.district,
    addressText: r.address_text,
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    coverPhotoUrl: r.cover_url,
    phone: r.phone,
    distanceMeters: r.distance_m != null ? Number(r.distance_m) : null,
  }));

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: offset + items.length < total,
  };
}
