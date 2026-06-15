/**
 * POST /api/admin/reindex-search — (re)build the OpenSearch index from all
 * ACTIVE businesses. ADMIN+.
 *
 * Runs inline in batches but caps the total to keep the request bounded; for a
 * full production reindex of a large dataset, use the CLI script (npm run reindex)
 * which streams without an HTTP timeout.
 */
import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLog } from "@/db/queries/users";
import { ok, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { env } from "@/lib/env";
import { bulkIndex, ensureIndex } from "@/lib/search/opensearch";
import type { BusinessDoc } from "@/lib/search/opensearch";
import { actorContext } from "../_lib";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 500;
const MAX_DOCS = 10_000; // inline cap; beyond this, use the CLI.

type DocRow = {
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
  verified: boolean;
  completeness: number;
  cover_url: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
};

function toDoc(r: DocRow): BusinessDoc {
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
    ratingAvg: Number(r.rating_avg),
    reviewCount: Number(r.review_count),
    priceLevel: r.price_level,
    verified: r.verified,
    completeness: Number(r.completeness),
    coverPhotoUrl: r.cover_url,
    phone: r.phone,
    location:
      r.lat != null && r.lng != null
        ? { lat: Number(r.lat), lon: Number(r.lng) }
        : null,
  };
}

export async function POST() {
  try {
    const actor = await requireRole("ADMIN");

    if (env.SEARCH_ENGINE !== "opensearch") {
      return ok({
        count: 0,
        skipped: true,
        note: "SEARCH_ENGINE=postgres тул индекс шаардлагагүй. OpenSearch-д шилжсэн үед ажиллана.",
      });
    }

    await ensureIndex();

    let offset = 0;
    let count = 0;
    let truncated = false;

    for (;;) {
      const rows = (await db.execute(sql`
        SELECT
          b.id, b.slug, b.name, b.normalized_name, b.description,
          cat.slug AS category_slug, parent.slug AS parent_category_slug,
          cat.name_mn AS category_name_mn,
          loc.district, loc.address_text,
          b.rating_avg, b.review_count, b.price_level,
          (b.verification_status = 'VERIFIED') AS verified,
          b.completeness_score AS completeness,
          loc.latitude AS lat, loc.longitude AS lng,
          ct.phone,
          cover.image_url AS cover_url
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
        WHERE b.status = 'ACTIVE'
        ORDER BY b.created_at ASC
        LIMIT ${BATCH_SIZE} OFFSET ${offset}
      `)) as unknown as DocRow[];

      if (rows.length === 0) break;

      await bulkIndex(rows.map(toDoc));
      count += rows.length;
      offset += BATCH_SIZE;

      if (rows.length < BATCH_SIZE) break;
      if (count >= MAX_DOCS) {
        truncated = true;
        break;
      }
    }

    const { actorId, ip } = await actorContext(actor);
    await auditLog(actorId, "search.reindex", "search_index", env.OPENSEARCH_INDEX, null, { count, truncated }, ip);

    return ok({
      count,
      ...(truncated
        ? { truncated: true, note: `${MAX_DOCS}-аас дээш бичлэгийг CLI (npm run reindex) ашиглан индекслэнэ үү.` }
        : {}),
    });
  } catch (e) {
    return handleError(e);
  }
}
