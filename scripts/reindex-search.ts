/**
 * Rebuild the OpenSearch index from PostgreSQL.
 *
 *   npm run reindex
 *
 * Ensures the index exists (with the Mongolian-aware mapping), then streams all
 * ACTIVE businesses — joined with their location, primary category, and cover
 * photo — into BusinessDoc[] and bulk-indexes them in batches of 500.
 *
 * NOTE: src/lib/search/opensearch.ts begins with `import "server-only"`, which
 * is a Next.js bundler shim that doesn't resolve under plain `tsx`. The
 * `reindex` npm script preloads scripts/_register-server-only.mjs to stub it,
 * so this file can import the real exports.
 */
import "./_shared";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { bulkIndex, type BusinessDoc, ensureIndex } from "@/lib/search/opensearch";

import { closeDb } from "./_shared";

const BATCH = 500;

type Row = {
  id: string;
  slug: string;
  name: string;
  normalized_name: string | null;
  description: string | null;
  category_slug: string | null;
  parent_category_slug: string | null;
  category_name_mn: string | null;
  district: string | null;
  address_text: string | null;
  rating_avg: number;
  review_count: number;
  price_level: number | null;
  verification_status: string;
  completeness_score: number;
  cover_photo_url: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
};

function toDoc(r: Row): BusinessDoc {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    normalizedName: r.normalized_name,
    description: r.description,
    categorySlug: r.category_slug,
    parentCategorySlug: r.parent_category_slug,
    categoryNameMn: r.category_name_mn,
    district: r.district,
    addressText: r.address_text,
    ratingAvg: r.rating_avg,
    reviewCount: r.review_count,
    priceLevel: r.price_level,
    verified: r.verification_status === "VERIFIED",
    completeness: r.completeness_score,
    coverPhotoUrl: r.cover_photo_url,
    phone: r.phone,
    location:
      r.latitude != null && r.longitude != null
        ? { lat: r.latitude, lon: r.longitude }
        : null,
  };
}

async function main(): Promise<void> {
  console.log("🔎 Хайлтын индекс дахин үүсгэж байна…");

  await ensureIndex();
  console.log("  ✓ Индекс бэлэн.");

  const rows = await db.execute<Row>(sql`
    SELECT
      b.id, b.slug, b.name, b.normalized_name, b.description,
      cat.slug AS category_slug,
      parent.slug AS parent_category_slug,
      cat.name_mn AS category_name_mn,
      l.district, l.address_text, l.latitude, l.longitude,
      b.rating_avg, b.review_count, b.price_level,
      b.verification_status, b.completeness_score,
      c.phone,
      cover.image_url AS cover_photo_url
    FROM businesses b
    LEFT JOIN business_locations l ON l.business_id = b.id
    LEFT JOIN business_contacts c ON c.business_id = b.id
    LEFT JOIN categories cat ON cat.id = b.primary_category_id
    LEFT JOIN categories parent ON parent.id = cat.parent_id
    LEFT JOIN LATERAL (
      SELECT image_url FROM business_photos p
      WHERE p.business_id = b.id AND p.status = 'APPROVED'
      ORDER BY p.is_cover DESC, p.sort_order ASC
      LIMIT 1
    ) cover ON true
    WHERE b.status = 'ACTIVE'
    ORDER BY b.created_at ASC
  `);

  console.log(`  ✓ ${rows.length} идэвхтэй бизнес ачааллаа.`);

  let indexed = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(toDoc);
    await bulkIndex(batch);
    indexed += batch.length;
    console.log(`  … ${indexed}/${rows.length} индекслэв`);
  }

  console.log(`\n✅ Дууслаа: ${indexed} бизнес индекслэгдлээ.`);
}

main()
  .catch((err) => {
    console.error("\n❌ Reindex алдаа:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
    process.exit(process.exitCode ?? 0);
  });
