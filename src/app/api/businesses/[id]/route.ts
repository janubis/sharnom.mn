/**
 * GET /api/businesses/:id — full public business detail.
 *
 * The path param is a business id (UUID); for convenience we also accept a
 * slug. Returns the assembled BusinessDetail (business + location + contact +
 * hours + photos + category + owner) or 404 when missing/deleted/duplicate.
 */
import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { businesses } from "@/db/schema";
import { fail, handleError, ok } from "@/lib/api";
import { getBusinessBySlug } from "@/db/queries/businesses";
import { idSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    // Resolve the slug: by id when the param is a UUID, otherwise treat the
    // param itself as the slug.
    let slug: string | null = null;
    if (idSchema.safeParse(id).success) {
      const row = await db.query.businesses.findFirst({
        where: eq(businesses.id, id),
        columns: { slug: true },
      });
      slug = row?.slug ?? null;
    } else {
      slug = id;
    }

    if (!slug) return fail("Бизнес олдсонгүй", 404);

    const detail = await getBusinessBySlug(slug);
    if (!detail) return fail("Бизнес олдсонгүй", 404);

    return ok(detail);
  } catch (e) {
    return handleError(e);
  }
}
