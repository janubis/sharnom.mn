/**
 * Stage-2 search: OpenSearch.
 *
 * Skeleton that mirrors the PostgreSQL contract. Provides the index mapping
 * (Mongolian-aware analysis), a document shape, an indexer, and a query
 * builder with geo-distance + function_score ranking. Wire it up by setting
 * SEARCH_ENGINE=opensearch and running `npm run reindex`.
 */
import "server-only";

import { Client } from "@opensearch-project/opensearch";

import { env } from "@/lib/env";
import type { SearchItem, SearchParams, SearchResult } from "./types";

let _client: Client | null = null;
export function osClient(): Client {
  if (!_client) {
    _client = new Client({
      node: env.OPENSEARCH_URL,
      auth:
        env.OPENSEARCH_USERNAME && env.OPENSEARCH_PASSWORD
          ? { username: env.OPENSEARCH_USERNAME, password: env.OPENSEARCH_PASSWORD }
          : undefined,
      ssl: { rejectUnauthorized: false },
    });
  }
  return _client;
}

export type BusinessDoc = {
  id: string;
  slug: string;
  name: string;
  normalizedName: string | null;
  description: string | null;
  categorySlug: string | null;
  parentCategorySlug: string | null;
  categoryNameMn: string | null;
  district: string | null;
  addressText: string | null;
  ratingAvg: number;
  reviewCount: number;
  priceLevel: number | null;
  verified: boolean;
  completeness: number;
  coverPhotoUrl: string | null;
  phone: string | null;
  location: { lat: number; lon: number } | null;
};

/**
 * Index mapping. Uses an ICU/folding analyzer so Cyrillic & Latin variants
 * match, plus an edge-ngram analyzer for autocomplete.
 */
export const INDEX_SETTINGS = {
  settings: {
    analysis: {
      filter: {
        autocomplete_filter: { type: "edge_ngram", min_gram: 2, max_gram: 20 },
      },
      analyzer: {
        mn_text: {
          type: "custom",
          tokenizer: "standard",
          filter: ["lowercase", "icu_folding"],
        },
        mn_autocomplete: {
          type: "custom",
          tokenizer: "standard",
          filter: ["lowercase", "icu_folding", "autocomplete_filter"],
        },
      },
    },
  },
  mappings: {
    properties: {
      name: {
        type: "text",
        analyzer: "mn_text",
        fields: {
          autocomplete: { type: "text", analyzer: "mn_autocomplete", search_analyzer: "mn_text" },
          keyword: { type: "keyword" },
        },
      },
      normalizedName: { type: "text", analyzer: "mn_text" },
      description: { type: "text", analyzer: "mn_text" },
      categorySlug: { type: "keyword" },
      parentCategorySlug: { type: "keyword" },
      district: { type: "keyword" },
      ratingAvg: { type: "float" },
      reviewCount: { type: "integer" },
      priceLevel: { type: "integer" },
      verified: { type: "boolean" },
      completeness: { type: "integer" },
      location: { type: "geo_point" },
    },
  },
} as const;

export async function ensureIndex(): Promise<void> {
  const index = env.OPENSEARCH_INDEX;
  const exists = await osClient().indices.exists({ index });
  if (!exists.body) {
    await osClient().indices.create({ index, body: INDEX_SETTINGS as object });
  }
}

export async function bulkIndex(docs: BusinessDoc[]): Promise<void> {
  if (docs.length === 0) return;
  const body = docs.flatMap((d) => [
    { index: { _index: env.OPENSEARCH_INDEX, _id: d.id } },
    d,
  ]);
  await osClient().bulk({ body, refresh: false });
}

/** Build the OpenSearch query body from SearchParams (ranking included). */
export function buildQuery(params: SearchParams) {
  const filter: object[] = [];
  if (params.categorySlug) {
    filter.push({
      bool: {
        should: [
          { term: { categorySlug: params.categorySlug } },
          { term: { parentCategorySlug: params.categorySlug } },
        ],
      },
    });
  }
  if (params.district) filter.push({ term: { district: params.district } });
  if (params.verifiedOnly) filter.push({ term: { verified: true } });
  if (params.minRating != null) filter.push({ range: { ratingAvg: { gte: params.minRating } } });
  if (params.priceLevels?.length) filter.push({ terms: { priceLevel: params.priceLevels } });
  if (params.lat != null && params.lng != null && params.radiusKm) {
    filter.push({
      geo_distance: { distance: `${params.radiusKm}km`, location: { lat: params.lat, lon: params.lng } },
    });
  }

  const must = params.q
    ? [
        {
          multi_match: {
            query: params.q,
            fields: ["name^3", "name.autocomplete^2", "normalizedName^2", "description"],
            fuzziness: "AUTO",
            type: "best_fields",
          },
        },
      ]
    : [{ match_all: {} }];

  // function_score blends text relevance with rating/popularity/proximity.
  return {
    function_score: {
      query: { bool: { must, filter } },
      functions: [
        { field_value_factor: { field: "ratingAvg", factor: 1.2, missing: 0 } },
        { field_value_factor: { field: "reviewCount", factor: 0.05, modifier: "ln1p", missing: 0 } },
        { field_value_factor: { field: "completeness", factor: 0.01, missing: 0 } },
        ...(params.lat != null && params.lng != null
          ? [
              {
                gauss: {
                  location: {
                    origin: { lat: params.lat, lon: params.lng },
                    scale: "3km",
                    decay: 0.5,
                  },
                },
              },
            ]
          : []),
      ],
      score_mode: "sum",
      boost_mode: "multiply",
    },
  };
}

/** Execute a search and map hits to the shared SearchItem shape. */
export async function searchBusinessesOs(params: SearchParams): Promise<SearchResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, params.pageSize ?? 20);
  const from = (page - 1) * pageSize;

  const sortBy: Record<string, object[]> = {
    rating: [{ ratingAvg: { order: "desc" } }],
    reviews: [{ reviewCount: { order: "desc" } }],
    newest: [{ createdAt: { order: "desc" } }],
  };

  const client = osClient();
  const res = await client.search({
    index: env.OPENSEARCH_INDEX,
    body: {
      from,
      size: pageSize,
      query: buildQuery(params),
      ...(params.sort && sortBy[params.sort] ? { sort: sortBy[params.sort] } : {}),
    },
    // Our query DSL is broader than the client's strict request type.
  } as unknown as Parameters<typeof client.search>[0]);

  const hits = res.body.hits.hits as unknown as Array<{ _source: BusinessDoc }>;
  const total =
    typeof res.body.hits.total === "object"
      ? res.body.hits.total.value
      : (res.body.hits.total as number);

  const items: SearchItem[] = hits.map(({ _source: d }) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    description: d.description,
    ratingAvg: d.ratingAvg,
    reviewCount: d.reviewCount,
    priceLevel: d.priceLevel,
    verified: d.verified,
    category: d.categorySlug
      ? { nameMn: d.categoryNameMn ?? "", slug: d.categorySlug, icon: null }
      : null,
    district: d.district,
    addressText: d.addressText,
    lat: d.location?.lat ?? null,
    lng: d.location?.lon ?? null,
    coverPhotoUrl: d.coverPhotoUrl,
    phone: d.phone,
    distanceMeters: null,
  }));

  return { items, total, page, pageSize, hasMore: from + items.length < total };
}

/** Autocomplete suggestions (name prefix). */
export async function autocompleteOs(prefix: string, limit = 8): Promise<string[]> {
  if (!prefix.trim()) return [];
  const client = osClient();
  const res = await client.search({
    index: env.OPENSEARCH_INDEX,
    body: {
      size: limit,
      _source: ["name"],
      query: { match: { "name.autocomplete": { query: prefix, operator: "and" } } },
    },
  } as unknown as Parameters<typeof client.search>[0]);
  return (res.body.hits.hits as unknown as Array<{ _source: { name: string } }>).map(
    (h) => h._source.name,
  );
}
