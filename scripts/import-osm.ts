/**
 * Import Ulaanbaatar POIs from OpenStreetMap via the Overpass API.
 *
 *   npm run import:osm                     # live import, default UB bbox
 *   npm run import:osm -- --dry-run        # parse + dedupe, write nothing
 *   npm run import:osm -- --bbox=47.85,106.78,47.96,107.02
 *   npm run import:osm -- --limit=200
 *
 * For each candidate node we map OSM tags → our leaf category, normalise the
 * name, and run duplicateConfidence against nearby existing businesses. Rows
 * scoring >= DUPLICATE_THRESHOLD are skipped; the rest are inserted with
 * source='osm', sourceId='node/<id>'. Manually-verified businesses are never
 * touched. Everything is recorded in an import_jobs row (RUNNING → DONE).
 */
import "./_shared";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import * as t from "@/db/schema";
import { duplicateConfidence, DUPLICATE_THRESHOLD, normalizeBusinessName } from "@/lib/normalize";
import { slugify } from "@/lib/utils";

import {
  closeDb,
  findNearbyBusinesses,
  getArg,
  hasFlag,
  loadCategoryIdBySlug,
  recomputeAggregates,
} from "./_shared";

/* ───────────────────────── OSM tag → category map ────────────────────────── */

/** amenity / shop value → our leaf category slug. */
const TAG_TO_CATEGORY: Record<string, string> = {
  // amenity
  restaurant: "restaurant",
  fast_food: "fast-food",
  cafe: "cafe",
  bar: "pub-lounge",
  pub: "pub-lounge",
  pharmacy: "clinic",
  hospital: "clinic",
  clinic: "clinic",
  doctors: "clinic",
  dentist: "dental",
  cinema: "cinema",
  nightclub: "karaoke",
  university: "university",
  college: "university",
  school: "school",
  kindergarten: "kindergarten",
  car_wash: "laundry",
  car_repair: "auto-repair",
  // shop
  supermarket: "supermarket",
  convenience: "store",
  bakery: "bakery",
  hairdresser: "hair-salon",
  beauty: "beauty-salon",
  clothes: "clothing",
  florist: "florist",
  electronics: "electronics",
  car_parts: "auto-repair",
  car: "auto-repair",
  // tourism
  hotel: "hotel",
  guest_house: "hotel",
  hostel: "hotel",
  resort: "resort",
};

const DEFAULT_BBOX = { south: 47.84, west: 106.76, north: 47.97, east: 107.06 };
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "MongolLocal-Importer/1.0 (https://mongol-local.mn)";

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function parseBbox(): { south: number; west: number; north: number; east: number } {
  const raw = getArg("bbox");
  if (!raw) return DEFAULT_BBOX;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    console.warn(`⚠ Буруу --bbox="${raw}", үндсэн bbox ашиглана.`);
    return DEFAULT_BBOX;
  }
  const [south, west, north, east] = parts as [number, number, number, number];
  return { south, west, north, east };
}

function buildOverpassQuery(b: ReturnType<typeof parseBbox>): string {
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  // Pull the relevant amenity/shop/tourism POIs. nwr = node|way|relation, with
  // `out center` so ways/relations get a representative coordinate.
  return `
    [out:json][timeout:60];
    (
      nwr["amenity"~"^(restaurant|fast_food|cafe|bar|pub|pharmacy|hospital|clinic|doctors|dentist|cinema|nightclub|university|college|school|kindergarten|car_wash|car_repair)$"](${bbox});
      nwr["shop"~"^(supermarket|convenience|bakery|hairdresser|beauty|clothes|florist|electronics|car_parts|car)$"](${bbox});
      nwr["tourism"~"^(hotel|guest_house|hostel|resort)$"](${bbox});
    );
    out center tags;
  `.trim();
}

function categoryForTags(tags: Record<string, string>): string | null {
  for (const key of ["amenity", "shop", "tourism"]) {
    const val = tags[key];
    if (val && TAG_TO_CATEGORY[val]) return TAG_TO_CATEGORY[val]!;
  }
  return null;
}

async function fetchOverpass(query: string): Promise<OverpassElement[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Overpass HTTP ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as { elements?: OverpassElement[] };
    return json.elements ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

/* ──────────────────────────────── main ───────────────────────────────────── */

async function main(): Promise<void> {
  const dryRun = hasFlag("dry-run");
  const limit = Number(getArg("limit") ?? "0") || Infinity;
  const bbox = parseBbox();

  console.log(`🗺  OSM импорт${dryRun ? " (dry-run)" : ""} — bbox ${JSON.stringify(bbox)}`);

  // Open an import job (skip persistence in dry-run).
  let jobId: string | null = null;
  if (!dryRun) {
    const [job] = await db
      .insert(t.importJobs)
      .values({ source: "osm", fileName: `overpass:${JSON.stringify(bbox)}`, status: "RUNNING" })
      .returning({ id: t.importJobs.id });
    jobId = job!.id;
  }

  const counts = { total: 0, inserted: 0, duplicates: 0, skipped: 0, errors: 0 };
  const logEntries: string[] = [];

  try {
    const catBySlug = await loadCategoryIdBySlug();

    console.log("→ Overpass API-аас татаж байна…");
    const elements = await fetchOverpass(buildOverpassQuery(bbox));
    console.log(`  ✓ ${elements.length} элемент ирлээ.`);

    for (const el of elements) {
      if (counts.inserted >= limit) break;
      const tags = el.tags ?? {};
      const name = tags["name:mn"] || tags.name || tags["name:en"];
      if (!name) {
        counts.skipped++;
        continue;
      }
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null) {
        counts.skipped++;
        continue;
      }
      const categorySlug = categoryForTags(tags);
      if (!categorySlug) {
        counts.skipped++;
        continue;
      }
      counts.total++;

      const phone = tags.phone ?? tags["contact:phone"] ?? null;
      const website = tags.website ?? tags["contact:website"] ?? null;

      // Dedupe against nearby existing businesses (~150 m box).
      const nearby = await findNearbyBusinesses(lat, lng, 150);
      let bestScore = 0;
      for (const cand of nearby) {
        const score = duplicateConfidence(
          { name, phone, lat, lng, categorySlug },
          {
            name: cand.name,
            phone: cand.phone,
            lat: cand.lat,
            lng: cand.lng,
            categorySlug: cand.categorySlug,
          },
        );
        if (score > bestScore) bestScore = score;
      }

      if (bestScore >= DUPLICATE_THRESHOLD) {
        counts.duplicates++;
        logEntries.push(`dup(${bestScore.toFixed(2)}): ${name}`);
        continue;
      }

      const sourceId = `${el.type}/${el.id}`;
      const confidence = Number((1 - bestScore).toFixed(3));

      if (dryRun) {
        counts.inserted++;
        console.log(`  + [dry] ${name} → ${categorySlug} (conf ${confidence})`);
        continue;
      }

      // Skip if this exact source node was imported before.
      const existing = await db
        .select({ id: t.businesses.id })
        .from(t.businesses)
        .where(sql`${t.businesses.source} = 'osm' AND ${t.businesses.sourceId} = ${sourceId}`)
        .limit(1);
      if (existing[0]) {
        counts.duplicates++;
        continue;
      }

      let slug = slugify(name);
      // Ensure slug uniqueness by appending the OSM id when needed.
      const slugTaken = await db
        .select({ id: t.businesses.id })
        .from(t.businesses)
        .where(eq(t.businesses.slug, slug))
        .limit(1);
      if (slugTaken[0]) slug = `${slug}-${el.id}`;

      const [biz] = await db
        .insert(t.businesses)
        .values({
          name,
          normalizedName: normalizeBusinessName(name),
          slug,
          primaryCategoryId: catBySlug.get(categorySlug) ?? null,
          status: "ACTIVE",
          source: "osm",
          sourceId,
          confidenceScore: confidence,
          publishedAt: new Date(),
        })
        .returning({ id: t.businesses.id });
      const businessId = biz!.id;

      const addressText =
        tags["addr:full"] ??
        ([tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ") || null);
      await db.insert(t.businessLocations).values({
        businessId,
        addressText,
        district: tags["addr:district"] ?? null,
        latitude: lat,
        longitude: lng,
      });

      if (phone || website) {
        await db.insert(t.businessContacts).values({ businessId, phone, website });
      }

      counts.inserted++;
      console.log(`  + ${name} → ${categorySlug} (conf ${confidence})`);
    }

    if (jobId) {
      await db
        .update(t.importJobs)
        .set({
          status: "DONE",
          totalRows: counts.total,
          inserted: counts.inserted,
          duplicates: counts.duplicates,
          errors: counts.errors,
          log: { skipped: counts.skipped, sample: logEntries.slice(0, 50) },
          finishedAt: new Date(),
        })
        .where(eq(t.importJobs.id, jobId));

      console.log("→ Нэгтгэсэн үзүүлэлтүүдийг дахин тооцоолж байна…");
      await recomputeAggregates();
    }

    console.log(
      `\n✅ Дууслаа${dryRun ? " (dry-run)" : ""}: ${counts.inserted} нэмсэн, ` +
        `${counts.duplicates} давхардсан, ${counts.skipped} алгассан.`,
    );
  } catch (err) {
    counts.errors++;
    if (jobId) {
      await db
        .update(t.importJobs)
        .set({ status: "FAILED", errors: counts.errors, log: { error: String(err) }, finishedAt: new Date() })
        .where(eq(t.importJobs.id, jobId));
    }
    throw err;
  }
}

main()
  .catch((err) => {
    console.error("\n❌ OSM импорт алдаа:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
    process.exit(process.exitCode ?? 0);
  });
