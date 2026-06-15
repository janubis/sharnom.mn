/**
 * Saved (bookmarked) businesses. Toggling keeps the denormalised
 * businesses.saved_count in sync. Listing returns SearchItem-shaped rows so the
 * /saved page can reuse the standard business card.
 */
import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { savedBusinesses } from "@/db/schema";
import { PAGE_SIZE } from "@/lib/constants";
import type { SearchItem, SearchResult } from "@/lib/search/types";

/** Toggle a save for (user, business). Returns the resulting saved state. */
export async function toggleSave(
  userId: string,
  businessId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const existing = await tx.query.savedBusinesses.findFirst({
      where: and(
        eq(savedBusinesses.userId, userId),
        eq(savedBusinesses.businessId, businessId),
      ),
    });

    if (existing) {
      await tx
        .delete(savedBusinesses)
        .where(
          and(
            eq(savedBusinesses.userId, userId),
            eq(savedBusinesses.businessId, businessId),
          ),
        );
      await tx.execute(
        sql`UPDATE businesses SET saved_count = GREATEST(saved_count - 1, 0) WHERE id = ${businessId}`,
      );
      return false;
    }

    await tx
      .insert(savedBusinesses)
      .values({ userId, businessId })
      .onConflictDoNothing();
    await tx.execute(
      sql`UPDATE businesses SET saved_count = saved_count + 1 WHERE id = ${businessId}`,
    );
    return true;
  });
}

/** Whether the user has saved the given business. */
export async function isSaved(userId: string, businessId: string): Promise<boolean> {
  const row = await db.query.savedBusinesses.findFirst({
    where: and(
      eq(savedBusinesses.userId, userId),
      eq(savedBusinesses.businessId, businessId),
    ),
    columns: { businessId: true },
  });
  return !!row;
}

/** Set of businessIds (from a candidate list) the user has saved — for cards. */
export async function savedIdsForUser(
  userId: string,
  businessIds: string[],
): Promise<Set<string>> {
  if (businessIds.length === 0) return new Set();
  const rows = (await db.execute(sql`
    SELECT business_id FROM saved_businesses
    WHERE user_id = ${userId} AND business_id = ANY(${businessIds})
  `)) as unknown as Array<{ business_id: string }>;
  return new Set(rows.map((r) => r.business_id));
}

/**
 * The user's saved businesses, newest-saved first, paginated. Returns a
 * SearchResult so it slots into the same card grid as search/category pages.
 */
export async function listSavedBusinesses(
  userId: string,
  page = 1,
  pageSize = PAGE_SIZE,
): Promise<SearchResult> {
  const p = Math.max(1, page);
  const size = Math.min(60, pageSize);
  const offset = (p - 1) * size;

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
      COUNT(*) OVER() AS total
    FROM saved_businesses sb
    JOIN businesses b ON b.id = sb.business_id AND b.status = 'ACTIVE'
    LEFT JOIN business_locations loc ON loc.business_id = b.id
    LEFT JOIN business_contacts ct ON ct.business_id = b.id
    LEFT JOIN categories cat ON cat.id = b.primary_category_id
    LEFT JOIN LATERAL (
      SELECT image_url FROM business_photos p
      WHERE p.business_id = b.id AND p.status = 'APPROVED'
      ORDER BY p.is_cover DESC, p.sort_order ASC
      LIMIT 1
    ) cover ON true
    WHERE sb.user_id = ${userId}
    ORDER BY sb.created_at DESC
    LIMIT ${size} OFFSET ${offset}
  `)) as unknown as Array<{
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
    phone: string | null;
    cover_url: string | null;
    total: number;
  }>;

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
    distanceMeters: null,
  }));

  return { items, total, page: p, pageSize: size, hasMore: offset + items.length < total };
}
