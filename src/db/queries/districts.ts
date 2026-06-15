/**
 * District (düüreg) queries — power the district filter, district landing pages
 * and the home "explore by district" section. District identity comes from the
 * static UB_DISTRICTS list; counts are computed from ACTIVE businesses.
 */
import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { DISTRICT_BY_SLUG, UB_DISTRICTS } from "@/lib/constants";
import type { District } from "@/lib/constants";
import { searchBusinesses } from "@/lib/search";
import type { SearchItem } from "@/lib/search/types";

export type DistrictWithCount = District & { businessCount: number };

/** All UB districts, each annotated with its ACTIVE business count. */
export async function listDistricts(): Promise<DistrictWithCount[]> {
  const rows = (await db.execute(sql`
    SELECT loc.district AS slug, COUNT(*)::int AS count
    FROM businesses b
    JOIN business_locations loc ON loc.business_id = b.id
    WHERE b.status = 'ACTIVE' AND loc.district IS NOT NULL
    GROUP BY loc.district
  `)) as unknown as Array<{ slug: string; count: number }>;

  const counts = new Map(rows.map((r) => [r.slug, Number(r.count)]));

  return UB_DISTRICTS.map((d) => ({
    ...d,
    businessCount: counts.get(d.slug) ?? 0,
  }));
}

/** A single district by slug, with its ACTIVE business count, or null. */
export async function getDistrictBySlug(
  slug: string,
): Promise<DistrictWithCount | null> {
  const district = DISTRICT_BY_SLUG[slug];
  if (!district) return null;

  const rows = (await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM businesses b
    JOIN business_locations loc ON loc.business_id = b.id
    WHERE b.status = 'ACTIVE' AND loc.district = ${slug}
  `)) as unknown as Array<{ count: number }>;

  return { ...district, businessCount: rows[0] ? Number(rows[0].count) : 0 };
}

export type DistrictCategoryGroup = {
  category: { id: string; nameMn: string; slug: string; icon: string | null };
  businesses: SearchItem[];
};

/**
 * Top businesses in a district grouped by their leaf category (best-rated
 * `perCategory` each). Drives the district landing page. Returns groups
 * ordered by total district presence.
 */
export async function topBusinessesByDistrict(
  slug: string,
  perCategory = 4,
): Promise<DistrictCategoryGroup[]> {
  if (!DISTRICT_BY_SLUG[slug]) return [];

  // Rank businesses within each category by rating, keep the top N per category.
  const rows = (await db.execute(sql`
    SELECT * FROM (
      SELECT
        b.id, b.slug, b.name, b.description,
        b.rating_avg, b.review_count, b.price_level,
        (b.verification_status = 'VERIFIED') AS verified,
        cat.id AS cat_id, cat.name_mn AS cat_name, cat.slug AS cat_slug, cat.icon AS cat_icon,
        loc.district, loc.address_text,
        loc.latitude AS lat, loc.longitude AS lng,
        ct.phone,
        cover.image_url AS cover_url,
        ROW_NUMBER() OVER (
          PARTITION BY b.primary_category_id
          ORDER BY b.rating_avg DESC, b.review_count DESC
        ) AS rn
      FROM businesses b
      JOIN business_locations loc ON loc.business_id = b.id
      LEFT JOIN business_contacts ct ON ct.business_id = b.id
      JOIN categories cat ON cat.id = b.primary_category_id
      LEFT JOIN LATERAL (
        SELECT image_url FROM business_photos p
        WHERE p.business_id = b.id AND p.status = 'APPROVED'
        ORDER BY p.is_cover DESC, p.sort_order ASC
        LIMIT 1
      ) cover ON true
      WHERE b.status = 'ACTIVE' AND loc.district = ${slug}
    ) ranked
    WHERE rn <= ${perCategory}
    ORDER BY cat_name ASC, rating_avg DESC
  `)) as unknown as Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    rating_avg: number;
    review_count: number;
    price_level: number | null;
    verified: boolean;
    cat_id: string;
    cat_name: string;
    cat_slug: string;
    cat_icon: string | null;
    district: string | null;
    address_text: string | null;
    lat: number | null;
    lng: number | null;
    phone: string | null;
    cover_url: string | null;
    rn: number;
  }>;

  const groups = new Map<string, DistrictCategoryGroup>();
  for (const r of rows) {
    let group = groups.get(r.cat_id);
    if (!group) {
      group = {
        category: { id: r.cat_id, nameMn: r.cat_name, slug: r.cat_slug, icon: r.cat_icon },
        businesses: [],
      };
      groups.set(r.cat_id, group);
    }
    group.businesses.push({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      ratingAvg: Number(r.rating_avg),
      reviewCount: Number(r.review_count),
      priceLevel: r.price_level,
      verified: r.verified,
      category: { nameMn: r.cat_name, slug: r.cat_slug, icon: r.cat_icon },
      district: r.district,
      addressText: r.address_text,
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.lng != null ? Number(r.lng) : null,
      coverPhotoUrl: r.cover_url,
      phone: r.phone,
      distanceMeters: null,
    });
  }

  // Order groups by how many businesses they contributed (richest first).
  return [...groups.values()].sort((a, b) => b.businesses.length - a.businesses.length);
}

/** District businesses paginated (delegates to the search engine). */
export async function listDistrictBusinesses(
  slug: string,
  page = 1,
  pageSize?: number,
) {
  return searchBusinesses({ district: slug, sort: "recommended", page, pageSize });
}
