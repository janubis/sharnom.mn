/**
 * Detect & resolve duplicate businesses.
 *
 *   npm run dedupe                 # dry-run: print a report, change nothing
 *   npm run dedupe -- --apply      # mark losers as status='DUPLICATE'
 *
 * Strategy:
 *  1. Load ACTIVE businesses (with location/contact/category).
 *  2. Bucket by normalizedName prefix so we only compare plausibly-similar
 *     records (O(n²) within small buckets, not across the whole table).
 *  3. Within a bucket, compute duplicateConfidence pairwise. Pairs scoring
 *     >= DUPLICATE_THRESHOLD AND within ~80 m are treated as the same entity.
 *  4. Keep a "primary" (manually-verified wins; else higher confidence; else
 *     older record) and mark the other status='DUPLICATE'. Nothing is deleted.
 */
import "./_shared";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import * as t from "@/db/schema";
import { duplicateConfidence, DUPLICATE_THRESHOLD, normalizeBusinessName } from "@/lib/normalize";
import { haversineMeters } from "@/lib/utils";

import { closeDb, hasFlag } from "./_shared";

const PROXIMITY_M = 80;
const PREFIX_LEN = 4;

type Row = {
  id: string;
  name: string;
  normalizedName: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  categorySlug: string | null;
  manuallyVerified: boolean;
  confidenceScore: number;
  createdAt: Date;
};

/** Decide which of two duplicate rows survives as the primary. */
function primaryWins(a: Row, b: Row): { keep: Row; drop: Row } {
  // 1. manually-verified always wins
  if (a.manuallyVerified !== b.manuallyVerified) {
    return a.manuallyVerified ? { keep: a, drop: b } : { keep: b, drop: a };
  }
  // 2. higher confidence wins
  if (a.confidenceScore !== b.confidenceScore) {
    return a.confidenceScore > b.confidenceScore ? { keep: a, drop: b } : { keep: b, drop: a };
  }
  // 3. older record wins (newer is the dupe)
  return a.createdAt <= b.createdAt ? { keep: a, drop: b } : { keep: b, drop: a };
}

async function main(): Promise<void> {
  const apply = hasFlag("apply");
  console.log(`🔍 Давхардал шалгаж байна${apply ? " (--apply)" : " (dry-run)"}…`);

  const rows = await db.execute<{
    id: string;
    name: string;
    normalized_name: string | null;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
    category_slug: string | null;
    manually_verified: boolean;
    confidence_score: number;
    created_at: Date;
  }>(sql`
    SELECT b.id, b.name, b.normalized_name, c.phone,
           l.latitude, l.longitude, cat.slug AS category_slug,
           b.manually_verified, b.confidence_score, b.created_at
    FROM businesses b
    LEFT JOIN business_locations l ON l.business_id = b.id
    LEFT JOIN business_contacts c ON c.business_id = b.id
    LEFT JOIN categories cat ON cat.id = b.primary_category_id
    WHERE b.status = 'ACTIVE'
    ORDER BY b.created_at ASC
  `);

  const all: Row[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    normalizedName: r.normalized_name ?? normalizeBusinessName(r.name),
    phone: r.phone,
    lat: r.latitude,
    lng: r.longitude,
    categorySlug: r.category_slug,
    manuallyVerified: r.manually_verified,
    confidenceScore: r.confidence_score,
    createdAt: r.created_at,
  }));

  console.log(`  ✓ ${all.length} идэвхтэй бизнес ачааллаа.`);

  // Bucket by normalized-name prefix.
  const buckets = new Map<string, Row[]>();
  for (const row of all) {
    const norm = row.normalizedName ?? "";
    const prefix = norm.slice(0, PREFIX_LEN) || "_";
    const arr = buckets.get(prefix) ?? [];
    arr.push(row);
    buckets.set(prefix, arr);
  }

  const toDrop = new Map<string, { winner: Row; loser: Row; score: number }>();

  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i]!;
        const b = bucket[j]!;
        if (toDrop.has(a.id) || toDrop.has(b.id)) continue;

        // Proximity gate first (cheap) — both must have coords within 80 m.
        if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
          const dist = haversineMeters(a.lat, a.lng, b.lat, b.lng);
          if (dist > PROXIMITY_M) continue;
        }

        const score = duplicateConfidence(
          { name: a.name, phone: a.phone, lat: a.lat, lng: a.lng, categorySlug: a.categorySlug },
          { name: b.name, phone: b.phone, lat: b.lat, lng: b.lng, categorySlug: b.categorySlug },
        );
        if (score < DUPLICATE_THRESHOLD) continue;

        const { keep, drop } = primaryWins(a, b);
        toDrop.set(drop.id, { winner: keep, loser: drop, score });
      }
    }
  }

  if (toDrop.size === 0) {
    console.log("\n✅ Давхардал илрээгүй.");
    return;
  }

  console.log(`\n📋 ${toDrop.size} давхардсан хос илрэв:`);
  for (const { winner, loser, score } of toDrop.values()) {
    console.log(
      `  • "${loser.name}" → DUPLICATE (үлдэх: "${winner.name}", оноо ${score.toFixed(2)})`,
    );
  }

  if (!apply) {
    console.log(`\nℹ Dry-run. Хэрэгжүүлэхийн тулд --apply нэмж ажиллуулна уу.`);
    return;
  }

  let updated = 0;
  for (const { loser } of toDrop.values()) {
    // Safety: never demote a manually-verified record.
    if (loser.manuallyVerified) continue;
    await db
      .update(t.businesses)
      .set({ status: "DUPLICATE", updatedAt: new Date() })
      .where(eq(t.businesses.id, loser.id));
    updated++;
  }
  console.log(`\n✅ ${updated} бизнесийг DUPLICATE болголоо.`);
}

main()
  .catch((err) => {
    console.error("\n❌ Dedupe алдаа:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
    process.exit(process.exitCode ?? 0);
  });
