/**
 * GET /api/search/autocomplete?q — typeahead suggestions.
 *
 * Returns up to 8 business name suggestions + matching business {slug,name}
 * pairs. Uses OpenSearch's edge-ngram autocomplete when SEARCH_ENGINE is set,
 * otherwise a trigram/prefix ILIKE query against ACTIVE businesses (handles
 * Cyrillic well). Short revalidate so popular prefixes stay cheap.
 */
import "server-only";

import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";

import { handleError, ok, searchParamsToObject } from "@/lib/api";
import { db } from "@/db";
import { env } from "@/lib/env";
import { autocompleteOs } from "@/lib/search/opensearch";

export const revalidate = 30;

type Suggestion = { slug: string; name: string };

async function pgAutocomplete(q: string): Promise<Suggestion[]> {
  const like = `%${q}%`;
  const rows = (await db.execute(sql`
    SELECT b.slug, b.name
    FROM businesses b
    WHERE b.status = 'ACTIVE'
      AND (
        b.name ILIKE ${q + "%"}
        OR b.name ILIKE ${like}
        OR b.name % ${q}
        OR COALESCE(b.normalized_name, '') % ${q}
      )
    ORDER BY
      (b.name ILIKE ${q + "%"}) DESC,
      similarity(b.name, ${q}) DESC,
      b.review_count DESC,
      b.rating_avg DESC
    LIMIT 8
  `)) as unknown as Array<{ slug: string; name: string }>;
  return rows.map((r) => ({ slug: r.slug, name: r.name }));
}

export async function GET(req: NextRequest) {
  try {
    const { q } = searchParamsToObject(req.url);
    const query = (q ?? "").trim();

    if (query.length < 2) {
      return ok({ suggestions: [], businesses: [] });
    }

    let businesses: Suggestion[] = [];
    let suggestions: string[] = [];

    if (env.SEARCH_ENGINE === "opensearch") {
      try {
        suggestions = await autocompleteOs(query, 8);
        // OpenSearch returns names only; reuse the PG slug lookup to enrich.
        businesses = await pgAutocomplete(query);
      } catch {
        businesses = await pgAutocomplete(query);
        suggestions = businesses.map((b) => b.name);
      }
    } else {
      businesses = await pgAutocomplete(query);
      suggestions = businesses.map((b) => b.name);
    }

    // De-duplicate suggestion strings while preserving order.
    suggestions = [...new Set(suggestions)].slice(0, 8);

    return ok({ suggestions, businesses });
  } catch (e) {
    return handleError(e);
  }
}
