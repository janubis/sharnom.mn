/**
 * Search dispatcher — picks the engine from SEARCH_ENGINE (postgres|opensearch)
 * and caches popular result pages in Redis. UI/API only import from here.
 */
import "server-only";

import { createHash } from "node:crypto";

import { cached, cacheKeys } from "@/lib/redis";
import { env } from "@/lib/env";
import { searchBusinessesPg } from "./postgres";
import { searchBusinessesOs } from "./opensearch";
import type { SearchParams, SearchResult } from "./types";

export type { SearchParams, SearchResult, SearchItem } from "./types";

function paramHash(params: SearchParams): string {
  return createHash("sha1").update(JSON.stringify(params)).digest("hex").slice(0, 16);
}

export async function searchBusinesses(params: SearchParams): Promise<SearchResult> {
  const run = () =>
    env.SEARCH_ENGINE === "opensearch"
      ? searchBusinessesOs(params).catch(() => searchBusinessesPg(params)) // graceful fallback
      : searchBusinessesPg(params);

  // Cache only "broad" queries (no precise geo) for a short TTL.
  const cacheable = !params.lat && !params.bounds && (params.page ?? 1) <= 3;
  if (!cacheable) return run();

  return cached(cacheKeys.search(paramHash(params)), 60, run);
}
