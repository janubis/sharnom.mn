/**
 * Photo moderation — a grid of PENDING business + review photos with quick
 * approve / reject actions.
 */
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { AdminPageHeader } from "../_components/page-header";
import { PhotoGrid, type PendingPhoto } from "./photo-grid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Зургийн модерац" };

const PHOTO_LIMIT = 120;

async function getPendingPhotos(): Promise<PendingPhoto[]> {
  const rows = (await db.execute(sql`
    SELECT * FROM (
      SELECT
        bp.id, 'business' AS scope, bp.image_url, bp.caption,
        bp.business_id, b.name AS business_name, b.slug AS business_slug,
        bp.uploaded_by_user_id::text AS uploaded_by, bp.created_at
      FROM business_photos bp
      JOIN businesses b ON b.id = bp.business_id
      WHERE bp.status = 'PENDING'
      UNION ALL
      SELECT
        rp.id, 'review' AS scope, rp.image_url, NULL AS caption,
        rp.business_id, b.name AS business_name, b.slug AS business_slug,
        rp.user_id::text AS uploaded_by, rp.created_at
      FROM review_photos rp
      JOIN businesses b ON b.id = rp.business_id
      WHERE rp.status = 'PENDING'
    ) p
    ORDER BY p.created_at ASC
    LIMIT ${PHOTO_LIMIT}
  `)) as unknown as Array<{
    id: string;
    scope: "business" | "review";
    image_url: string;
    caption: string | null;
    business_id: string;
    business_name: string;
    business_slug: string;
    uploaded_by: string | null;
    created_at: string | Date;
  }>;

  return rows.map((r) => ({
    id: r.id,
    scope: r.scope,
    imageUrl: r.image_url,
    caption: r.caption,
    businessId: r.business_id,
    businessName: r.business_name,
    businessSlug: r.business_slug,
    uploadedBy: r.uploaded_by,
    createdAt: String(r.created_at),
  }));
}

export default async function AdminPhotosPage() {
  const photos = await getPendingPhotos();

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        title="Зургийн модерац"
        description={`${photos.length} зураг хүлээгдэж байна`}
      />
      <PhotoGrid photos={photos} />
    </div>
  );
}
