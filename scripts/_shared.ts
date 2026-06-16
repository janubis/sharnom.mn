/**
 * Shared helpers for the data-ingestion scripts (seed / import / dedupe / reindex).
 *
 * These run under `tsx` (see package.json scripts). Env is loaded from
 * `.env.local` here so every script picks it up by importing this module first.
 * They use the same Drizzle client as the app via the `@/` path alias
 * (tsconfig `paths` apply to tsx).
 */
// MUST be first: loads .env.local before `@/db` reads DATABASE_URL at import time.
import "./_env";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import * as t from "@/db/schema";
import {
  CATEGORY_TAXONOMY,
  type CategorySeed,
  DISTRICT_BY_SLUG,
  UB_CENTER,
} from "@/lib/constants";

/* ───────────────────────────── CLI helpers ───────────────────────────────── */

export function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

export function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

/** Closes the underlying postgres connection so the process can exit cleanly. */
export async function closeDb(): Promise<void> {
  // The drizzle client wraps a postgres-js client on `db.$client`.
  const client = (db as unknown as { $client?: { end?: () => Promise<void> } }).$client;
  if (client?.end) await client.end();
}

/** Deterministic small jitter so seeded pins don't stack on one coordinate. */
export function jitter(base: number, spreadDeg = 0.012): number {
  return base + (Math.random() - 0.5) * spreadDeg;
}

/** A point inside a UB district (falls back to the city centre). */
export function pointInDistrict(districtSlug: string): { lat: number; lng: number } {
  const d = DISTRICT_BY_SLUG[districtSlug];
  const base = d ?? { lat: UB_CENTER.lat, lng: UB_CENTER.lng };
  return { lat: jitter(base.lat), lng: jitter(base.lng) };
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ───────────────────────── Category resolution ───────────────────────────── */

/**
 * Resolves leaf-category slug → category UUID by reading the DB once.
 * Returns a map keyed by slug (parents and children both present).
 */
export async function loadCategoryIdBySlug(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: t.categories.id, slug: t.categories.slug })
    .from(t.categories);
  return new Map(rows.map((r) => [r.slug, r.id]));
}

/** Flattens the taxonomy to { parent, child } pairs for iteration. */
export function flatLeafCategories(): Array<{ parentSlug: string; leaf: CategorySeed }> {
  const out: Array<{ parentSlug: string; leaf: CategorySeed }> = [];
  for (const parent of CATEGORY_TAXONOMY) {
    for (const child of parent.children ?? []) {
      out.push({ parentSlug: parent.slug, leaf: child });
    }
  }
  return out;
}

/* ─────────────────────── Aggregate recomputation ─────────────────────────── */

/**
 * Recomputes denormalised aggregates for every business from source rows:
 *  - rating_avg / review_count  (from PUBLISHED reviews)
 *  - photo_count                (APPROVED business photos)
 *  - completeness_score         (0..100 from filled profile fields)
 * Then refreshes categories.business_count for ACTIVE businesses.
 *
 * Runs as a handful of set-based UPDATEs — safe to call repeatedly.
 */
export async function recomputeAggregates(): Promise<void> {
  // rating_avg + review_count from published reviews
  await db.execute(sql`
    UPDATE businesses b SET
      rating_avg = COALESCE(r.avg_rating, 0),
      review_count = COALESCE(r.cnt, 0)
    FROM (
      SELECT business_id,
             AVG(rating)::real AS avg_rating,
             COUNT(*)::int AS cnt
      FROM reviews
      WHERE status = 'PUBLISHED'
      GROUP BY business_id
    ) r
    WHERE b.id = r.business_id
  `);
  // zero-out businesses that now have no published reviews
  await db.execute(sql`
    UPDATE businesses b SET rating_avg = 0, review_count = 0
    WHERE NOT EXISTS (
      SELECT 1 FROM reviews r
      WHERE r.business_id = b.id AND r.status = 'PUBLISHED'
    )
  `);

  // photo_count from approved business photos
  await db.execute(sql`
    UPDATE businesses b SET
      photo_count = COALESCE(p.cnt, 0)
    FROM (
      SELECT business_id, COUNT(*)::int AS cnt
      FROM business_photos
      WHERE status = 'APPROVED'
      GROUP BY business_id
    ) p
    WHERE b.id = p.business_id
  `);
  await db.execute(sql`
    UPDATE businesses b SET photo_count = 0
    WHERE NOT EXISTS (
      SELECT 1 FROM business_photos p
      WHERE p.business_id = b.id AND p.status = 'APPROVED'
    )
  `);

  // completeness 0..100 — 12.5 pts per filled signal
  await db.execute(sql`
    UPDATE businesses b SET completeness_score = sub.score
    FROM (
      SELECT b.id,
        LEAST(100, (
          (CASE WHEN b.description IS NOT NULL AND length(b.description) > 0 THEN 1 ELSE 0 END) +
          (CASE WHEN b.primary_category_id IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN b.price_level IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN l.address_text IS NOT NULL AND length(l.address_text) > 0 THEN 1 ELSE 0 END) +
          (CASE WHEN l.latitude IS NOT NULL AND l.longitude IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN c.phone IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN c.website IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN b.photo_count > 0 THEN 1 ELSE 0 END)
        ) * 12.5)::smallint AS score
      FROM businesses b
      LEFT JOIN business_locations l ON l.business_id = b.id
      LEFT JOIN business_contacts c ON c.business_id = b.id
    ) sub
    WHERE b.id = sub.id
  `);

  // categories.business_count from ACTIVE businesses (primary category only)
  await db.execute(sql`
    UPDATE categories c SET business_count = COALESCE(x.cnt, 0)
    FROM (
      SELECT primary_category_id AS cid, COUNT(*)::int AS cnt
      FROM businesses
      WHERE status = 'ACTIVE' AND primary_category_id IS NOT NULL
      GROUP BY primary_category_id
    ) x
    WHERE c.id = x.cid
  `);
  await db.execute(sql`
    UPDATE categories c SET business_count = 0
    WHERE NOT EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.primary_category_id = c.id AND b.status = 'ACTIVE'
    )
  `);
}

/* ─────────────────────── Dedupe DB query helper ──────────────────────────── */

export type NearbyCandidate = {
  id: string;
  name: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  categorySlug: string | null;
  manuallyVerified: boolean;
  confidenceScore: number;
  status: string;
  createdAt: Date;
};

/**
 * Returns ACTIVE/DRAFT businesses whose location falls within a ~`radiusM`
 * metre bounding box of (lat,lng). Used by the import dedupe step.
 */
export async function findNearbyBusinesses(
  lat: number,
  lng: number,
  radiusM = 150,
): Promise<NearbyCandidate[]> {
  // ~111_320 m per degree latitude; longitude scaled by cos(lat).
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180) || 1);
  const minLat = lat - dLat;
  const maxLat = lat + dLat;
  const minLng = lng - dLng;
  const maxLng = lng + dLng;

  const rows = await db.execute<{
    id: string;
    name: string;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
    category_slug: string | null;
    manually_verified: boolean;
    confidence_score: number;
    status: string;
    created_at: Date;
  }>(sql`
    SELECT b.id, b.name, c.phone, l.latitude, l.longitude,
           cat.slug AS category_slug,
           b.manually_verified, b.confidence_score, b.status, b.created_at
    FROM businesses b
    JOIN business_locations l ON l.business_id = b.id
    LEFT JOIN business_contacts c ON c.business_id = b.id
    LEFT JOIN categories cat ON cat.id = b.primary_category_id
    WHERE b.status IN ('ACTIVE', 'DRAFT')
      AND l.latitude BETWEEN ${minLat} AND ${maxLat}
      AND l.longitude BETWEEN ${minLng} AND ${maxLng}
  `);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    lat: r.latitude,
    lng: r.longitude,
    categorySlug: r.category_slug,
    manuallyVerified: r.manually_verified,
    confidenceScore: r.confidence_score,
    status: r.status,
    createdAt: r.created_at,
  }));
}
