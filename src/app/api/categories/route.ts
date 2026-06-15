/**
 * GET /api/categories — the full two-level category tree (cacheable for 1h).
 */
import "server-only";

import { handleError, ok } from "@/lib/api";
import { getCategoryTree } from "@/db/queries/categories";

export const revalidate = 3600;

export async function GET() {
  try {
    const tree = await getCategoryTree();
    return ok(tree);
  } catch (e) {
    return handleError(e);
  }
}
