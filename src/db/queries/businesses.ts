/**
 * Business data-access layer.
 *
 * Server-only queries that power business detail pages, "similar"/"top rated"
 * carousels, owner & admin tables, de-duplication and merging. Geo / aggregate
 * work uses raw sql`` + db.execute(); everything else uses the typed Drizzle API.
 */
import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  businessContacts,
  businessHours,
  businessLocations,
  businessPhotos,
  businesses,
  categories,
  reviewPhotos,
  savedBusinesses,
  users,
} from "@/db/schema";
import type {
  Business,
  BusinessContact,
  BusinessHours,
  BusinessLocation,
  BusinessPhoto,
  Category,
} from "@/db/schema";
import { PAGE_SIZE } from "@/lib/constants";
import { searchBusinesses } from "@/lib/search";
import type { SearchItem } from "@/lib/search/types";

/* ───────────────────────────── Detail ────────────────────────────────────── */

export type BusinessDetail = {
  business: Business;
  location: BusinessLocation | null;
  contact: BusinessContact | null;
  hours: BusinessHours[];
  photos: BusinessPhoto[];
  category: Category | null;
  parentCategory: Category | null;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
};

/**
 * Full business detail for the public profile page. Returns `null` if the
 * business does not exist or has been deleted/marked duplicate.
 */
export async function getBusinessBySlug(slug: string): Promise<BusinessDetail | null> {
  const business = await db.query.businesses.findFirst({
    where: eq(businesses.slug, slug),
  });
  if (!business || business.status === "DELETED" || business.status === "DUPLICATE") {
    return null;
  }

  const [location, contact, hours, photos] = await Promise.all([
    db.query.businessLocations.findFirst({
      where: eq(businessLocations.businessId, business.id),
    }),
    db.query.businessContacts.findFirst({
      where: eq(businessContacts.businessId, business.id),
    }),
    db.query.businessHours.findMany({
      where: eq(businessHours.businessId, business.id),
      orderBy: [asc(businessHours.dayOfWeek)],
    }),
    db.query.businessPhotos.findMany({
      where: and(
        eq(businessPhotos.businessId, business.id),
        eq(businessPhotos.status, "APPROVED"),
      ),
      orderBy: [desc(businessPhotos.isCover), asc(businessPhotos.sortOrder)],
    }),
  ]);

  let category: Category | null = null;
  let parentCategory: Category | null = null;
  if (business.primaryCategoryId) {
    category =
      (await db.query.categories.findFirst({
        where: eq(categories.id, business.primaryCategoryId),
      })) ?? null;
    if (category?.parentId) {
      parentCategory =
        (await db.query.categories.findFirst({
          where: eq(categories.id, category.parentId),
        })) ?? null;
    }
  }

  let owner: BusinessDetail["owner"] = null;
  if (business.ownerUserId) {
    const o = await db.query.users.findFirst({
      where: eq(users.id, business.ownerUserId),
      columns: { id: true, name: true, image: true },
    });
    owner = o ?? null;
  }

  return {
    business,
    location: location ?? null,
    contact: contact ?? null,
    hours,
    photos,
    category,
    parentCategory,
    owner,
  };
}

/* ───────────────────────── Similar businesses ────────────────────────────── */

type SimilarRow = {
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
};

/**
 * Businesses similar to the given one: same or sibling category (matched on the
 * primary category OR its parent's children), nearest first when coordinates are
 * known. ACTIVE only, excludes the business itself. Returns SearchItem shape.
 */
export async function getSimilarBusinesses(
  businessId: string,
  categoryId: string | null,
  lat: number | null,
  lng: number | null,
  limit = 6,
): Promise<SearchItem[]> {
  const hasGeo = lat != null && lng != null;
  const point = hasGeo
    ? sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`
    : sql`NULL`;
  const distanceExpr = hasGeo ? sql`ST_Distance(loc.geog, ${point})` : sql`NULL::float8`;

  // Match same category OR any sibling under the same parent category.
  const categoryFilter = categoryId
    ? sql`AND (
        b.primary_category_id = ${categoryId}
        OR cat.parent_id = (SELECT parent_id FROM categories WHERE id = ${categoryId})
        OR cat.id = (SELECT parent_id FROM categories WHERE id = ${categoryId})
      )`
    : sql``;

  const orderExpr = hasGeo
    ? sql`${distanceExpr} ASC NULLS LAST, b.rating_avg DESC`
    : sql`b.rating_avg DESC, b.review_count DESC`;

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
      ${distanceExpr} AS distance_m
    FROM businesses b
    LEFT JOIN business_locations loc ON loc.business_id = b.id
    LEFT JOIN business_contacts ct ON ct.business_id = b.id
    LEFT JOIN categories cat ON cat.id = b.primary_category_id
    LEFT JOIN LATERAL (
      SELECT image_url FROM business_photos p
      WHERE p.business_id = b.id AND p.status = 'APPROVED'
      ORDER BY p.is_cover DESC, p.sort_order ASC
      LIMIT 1
    ) cover ON true
    WHERE b.status = 'ACTIVE'
      AND b.id <> ${businessId}
      ${categoryFilter}
    ORDER BY ${orderExpr}
    LIMIT ${limit}
  `)) as unknown as SimilarRow[];

  return rows.map(rowToSearchItem);
}

function rowToSearchItem(r: SimilarRow): SearchItem {
  return {
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
  };
}

/* ─────────────────────────── Discovery feeds ─────────────────────────────── */

/** Top-rated businesses, optionally scoped to a category/district. */
export async function getTopRated(
  limit = 8,
  opts?: { categorySlug?: string; district?: string },
): Promise<SearchItem[]> {
  const result = await searchBusinesses({
    categorySlug: opts?.categorySlug,
    district: opts?.district,
    sort: "rating",
    minRating: 1,
    page: 1,
    pageSize: limit,
  });
  return result.items;
}

/** Newest published businesses. */
export async function getNewest(limit = 8): Promise<SearchItem[]> {
  const result = await searchBusinesses({
    sort: "newest",
    page: 1,
    pageSize: limit,
  });
  return result.items;
}

/* ──────────────────────────── View counter ───────────────────────────────── */

export async function incrementViewCount(businessId: string): Promise<void> {
  await db
    .update(businesses)
    .set({ viewCount: sql`${businesses.viewCount} + 1` })
    .where(eq(businesses.id, businessId));
}

/* ─────────────────────── Aggregate recomputation ─────────────────────────── */

/**
 * Recompute denormalised aggregates for a business and persist them:
 *  - ratingAvg & reviewCount from PUBLISHED reviews
 *  - photoCount from APPROVED business photos + APPROVED review photos
 *  - completenessScore (0..100) from presence of profile fields
 */
export async function recomputeBusinessAggregates(businessId: string): Promise<void> {
  const [agg] = (await db.execute(sql`
    SELECT
      COALESCE(AVG(r.rating) FILTER (WHERE r.status = 'PUBLISHED'), 0) AS rating_avg,
      COUNT(*) FILTER (WHERE r.status = 'PUBLISHED') AS review_count
    FROM reviews r
    WHERE r.business_id = ${businessId}
  `)) as unknown as { rating_avg: number; review_count: number }[];

  const [photo] = (await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM business_photos bp
        WHERE bp.business_id = ${businessId} AND bp.status = 'APPROVED')
      +
      (SELECT COUNT(*) FROM review_photos rp
        WHERE rp.business_id = ${businessId} AND rp.status = 'APPROVED')
      AS photo_count
  `)) as unknown as { photo_count: number }[];

  const ratingAvg = agg ? Number(agg.rating_avg) : 0;
  const reviewCount = agg ? Number(agg.review_count) : 0;
  const photoCount = photo ? Number(photo.photo_count) : 0;

  const completenessScore = await computeCompleteness(businessId, photoCount);

  await db
    .update(businesses)
    .set({
      ratingAvg: Math.round(ratingAvg * 100) / 100,
      reviewCount,
      photoCount,
      completenessScore,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, businessId));
}

/**
 * Profile completeness 0..100 from presence of: phone, website, hours,
 * photos, description, category, coordinates. Each contributes a weight.
 */
async function computeCompleteness(
  businessId: string,
  photoCount: number,
): Promise<number> {
  const [row] = (await db.execute(sql`
    SELECT
      b.description IS NOT NULL AND length(trim(b.description)) > 0 AS has_description,
      b.primary_category_id IS NOT NULL AS has_category,
      ct.phone IS NOT NULL AND length(trim(ct.phone)) > 0 AS has_phone,
      ct.website IS NOT NULL AND length(trim(ct.website)) > 0 AS has_website,
      loc.latitude IS NOT NULL AND loc.longitude IS NOT NULL AS has_coords,
      (SELECT COUNT(*) FROM business_hours h
        WHERE h.business_id = b.id) > 0 AS has_hours
    FROM businesses b
    LEFT JOIN business_contacts ct ON ct.business_id = b.id
    LEFT JOIN business_locations loc ON loc.business_id = b.id
    WHERE b.id = ${businessId}
  `)) as unknown as {
    has_description: boolean;
    has_category: boolean;
    has_phone: boolean;
    has_website: boolean;
    has_coords: boolean;
    has_hours: boolean;
  }[];

  if (!row) return 0;

  // Weights sum to 100.
  let score = 0;
  if (row.has_phone) score += 18;
  if (row.has_website) score += 12;
  if (row.has_hours) score += 18;
  if (photoCount > 0) score += 20;
  if (row.has_description) score += 14;
  if (row.has_category) score += 10;
  if (row.has_coords) score += 8;

  return Math.min(100, score);
}

/* ──────────────────────────── Admin table ────────────────────────────────── */

export type AdminBusinessRow = {
  id: string;
  name: string;
  slug: string;
  status: Business["status"];
  verificationStatus: Business["verificationStatus"];
  ratingAvg: number;
  reviewCount: number;
  district: string | null;
  categoryName: string | null;
  createdAt: Date;
};

export type ListBusinessesForAdminParams = {
  q?: string;
  category?: string; // category slug
  verification?: Business["verificationStatus"];
  status?: Business["status"];
  page?: number;
  pageSize?: number;
};

/** Paginated, filtered admin business table joined with location + category. */
export async function listBusinessesForAdmin(
  params: ListBusinessesForAdminParams,
): Promise<{ items: AdminBusinessRow[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, params.pageSize ?? PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  const conds = [sql`b.status <> 'DELETED'`];
  if (params.q && params.q.trim()) {
    const q = params.q.trim();
    conds.push(sql`(b.name ILIKE ${"%" + q + "%"} OR b.slug ILIKE ${"%" + q + "%"})`);
  }
  if (params.category) {
    conds.push(sql`(cat.slug = ${params.category} OR parent.slug = ${params.category})`);
  }
  if (params.verification) {
    conds.push(sql`b.verification_status = ${params.verification}`);
  }
  if (params.status) {
    conds.push(sql`b.status = ${params.status}`);
  }
  const whereSql = sql.join(conds, sql` AND `);

  const rows = (await db.execute(sql`
    SELECT
      b.id, b.name, b.slug, b.status, b.verification_status,
      b.rating_avg, b.review_count, b.created_at,
      loc.district,
      cat.name_mn AS category_name,
      COUNT(*) OVER() AS total
    FROM businesses b
    LEFT JOIN business_locations loc ON loc.business_id = b.id
    LEFT JOIN categories cat ON cat.id = b.primary_category_id
    LEFT JOIN categories parent ON parent.id = cat.parent_id
    WHERE ${whereSql}
    ORDER BY b.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `)) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    status: Business["status"];
    verification_status: Business["verificationStatus"];
    rating_avg: number;
    review_count: number;
    created_at: string | Date;
    district: string | null;
    category_name: string | null;
    total: number;
  }>;

  const total = rows.length > 0 ? Number(rows[0]!.total) : 0;
  const items: AdminBusinessRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    verificationStatus: r.verification_status,
    ratingAvg: Number(r.rating_avg),
    reviewCount: Number(r.review_count),
    district: r.district,
    categoryName: r.category_name,
    createdAt: new Date(r.created_at),
  }));

  return { items, total };
}

/* ─────────────────────────── De-duplication ──────────────────────────────── */

export type DuplicateCandidate = {
  id: string;
  name: string;
  slug: string;
  normalizedName: string | null;
  district: string | null;
  reviewCount: number;
  distanceMeters: number | null;
  reason: "name" | "proximity" | "both";
};

/**
 * Likely duplicates of a business: same normalized_name OR within 80 metres.
 * Used by the admin merge tool. ACTIVE/DRAFT businesses only, excludes self.
 */
export async function findDuplicateCandidates(
  businessId: string,
): Promise<DuplicateCandidate[]> {
  const rows = (await db.execute(sql`
    WITH target AS (
      SELECT b.id, b.normalized_name, loc.geog
      FROM businesses b
      LEFT JOIN business_locations loc ON loc.business_id = b.id
      WHERE b.id = ${businessId}
    )
    SELECT
      b.id, b.name, b.slug, b.normalized_name, b.review_count,
      loc.district,
      CASE WHEN t.geog IS NOT NULL AND loc.geog IS NOT NULL
           THEN ST_Distance(loc.geog, t.geog) ELSE NULL END AS distance_m,
      (b.normalized_name IS NOT NULL AND b.normalized_name = t.normalized_name) AS name_match
    FROM businesses b
    CROSS JOIN target t
    LEFT JOIN business_locations loc ON loc.business_id = b.id
    WHERE b.id <> ${businessId}
      AND b.status IN ('ACTIVE', 'DRAFT')
      AND (
        (b.normalized_name IS NOT NULL AND b.normalized_name = t.normalized_name)
        OR (t.geog IS NOT NULL AND loc.geog IS NOT NULL
            AND ST_DWithin(loc.geog, t.geog, 80))
      )
    ORDER BY name_match DESC, distance_m ASC NULLS LAST
    LIMIT 25
  `)) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    normalized_name: string | null;
    review_count: number;
    district: string | null;
    distance_m: number | null;
    name_match: boolean;
  }>;

  return rows.map((r) => {
    const near = r.distance_m != null && Number(r.distance_m) <= 80;
    const reason: DuplicateCandidate["reason"] =
      r.name_match && near ? "both" : r.name_match ? "name" : "proximity";
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      normalizedName: r.normalized_name,
      district: r.district,
      reviewCount: Number(r.review_count),
      distanceMeters: r.distance_m != null ? Number(r.distance_m) : null,
      reason,
    };
  });
}

/**
 * Merge a duplicate into a primary business. Re-points reviews, photos and
 * saves to the primary, then marks the duplicate as DUPLICATE/DELETED. Wrapped
 * in a transaction. Nothing is hard-deleted. Returns false on conflict.
 */
export async function mergeBusinesses(
  primaryId: string,
  duplicateId: string,
): Promise<{ merged: boolean }> {
  if (primaryId === duplicateId) return { merged: false };

  await db.transaction(async (tx) => {
    // Re-point reviews that would NOT violate the one-per-user-per-business
    // unique constraint; conflicting ones (user already reviewed primary) are
    // hidden rather than re-pointed.
    await tx.execute(sql`
      UPDATE reviews r
      SET business_id = ${primaryId}, updated_at = now()
      WHERE r.business_id = ${duplicateId}
        AND NOT EXISTS (
          SELECT 1 FROM reviews r2
          WHERE r2.business_id = ${primaryId} AND r2.user_id = r.user_id
        )
    `);
    await tx.execute(sql`
      UPDATE reviews r
      SET status = 'HIDDEN', updated_at = now()
      WHERE r.business_id = ${duplicateId}
    `);

    // Re-point photos (review photos follow their review's business_id too).
    await tx
      .update(businessPhotos)
      .set({ businessId: primaryId })
      .where(eq(businessPhotos.businessId, duplicateId));
    await tx
      .update(reviewPhotos)
      .set({ businessId: primaryId })
      .where(eq(reviewPhotos.businessId, duplicateId));

    // Re-point saves, skipping users that already saved the primary.
    await tx.execute(sql`
      UPDATE saved_businesses s
      SET business_id = ${primaryId}
      WHERE s.business_id = ${duplicateId}
        AND NOT EXISTS (
          SELECT 1 FROM saved_businesses s2
          WHERE s2.business_id = ${primaryId} AND s2.user_id = s.user_id
        )
    `);
    await tx
      .delete(savedBusinesses)
      .where(eq(savedBusinesses.businessId, duplicateId));

    // Mark the duplicate as merged (DUPLICATE status keeps it discoverable in
    // admin while removing it from public search which filters on ACTIVE).
    await tx
      .update(businesses)
      .set({ status: "DUPLICATE", updatedAt: new Date() })
      .where(eq(businesses.id, duplicateId));
  });

  await recomputeBusinessAggregates(primaryId);
  return { merged: true };
}

/* ─────────────────────────── small helpers ───────────────────────────────── */

/** Resolve a business id from a slug (lightweight, no joins). */
export async function getBusinessIdBySlug(slug: string): Promise<string | null> {
  const row = await db.query.businesses.findFirst({
    where: eq(businesses.slug, slug),
    columns: { id: true },
  });
  return row?.id ?? null;
}

/** Whether the given user owns the business (used by owner-only mutations). */
export async function userOwnsBusiness(
  userId: string,
  businessId: string,
): Promise<boolean> {
  const row = await db.query.businesses.findFirst({
    where: and(eq(businesses.id, businessId), eq(businesses.ownerUserId, userId)),
    columns: { id: true },
  });
  return !!row;
}
