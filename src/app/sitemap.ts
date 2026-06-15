/**
 * Dynamic sitemap: home, all category & district landing pages, and the top
 * businesses by slug (capped). Pulls live data so newly published businesses
 * surface to crawlers. Failures degrade gracefully to the static routes.
 */
import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/utils";
import { UB_DISTRICTS } from "@/lib/constants";
import { getCategoryTree } from "@/db/queries/categories";
import { searchBusinesses } from "@/lib/search";

export const revalidate = 3600;

const MAX_BUSINESSES = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/search"), lastModified: now, changeFrequency: "daily", priority: 0.8 },
  ];

  // Districts (static reference data).
  for (const d of UB_DISTRICTS) {
    entries.push({
      url: absoluteUrl(`/district/${d.slug}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // Categories (parents + leaves).
  try {
    const tree = await getCategoryTree();
    for (const parent of tree) {
      entries.push({
        url: absoluteUrl(`/category/${parent.slug}`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
      for (const child of parent.children) {
        entries.push({
          url: absoluteUrl(`/category/${child.slug}`),
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }
  } catch {
    /* category fetch failed — keep the static routes */
  }

  // Top businesses by slug (paged to stay within the cap).
  try {
    const pageSize = 60;
    const pages = Math.ceil(MAX_BUSINESSES / pageSize);
    for (let page = 1; page <= pages; page++) {
      const result = await searchBusinesses({ sort: "rating", page, pageSize });
      for (const item of result.items) {
        entries.push({
          url: absoluteUrl(`/business/${item.slug}`),
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.5,
        });
      }
      if (!result.hasMore) break;
    }
  } catch {
    /* business fetch failed — keep what we have */
  }

  return entries;
}
