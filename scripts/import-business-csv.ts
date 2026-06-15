/**
 * Import businesses from a CSV file.
 *
 *   npm run import:csv                          # reads scripts/data/sample.csv
 *   npm run import:csv -- --file=mydata.csv     # reads scripts/data/mydata.csv
 *   npm run import:csv -- --dry-run
 *
 * Expected header (order-independent):
 *   name,category_slug,phone,website,address,district,khoroo,lat,lng,description,price_level
 *
 * Each row is validated with zod, normalised, and deduped against nearby
 * existing businesses (same logic as the OSM importer). New rows are inserted
 * with source='csv'. Manually-verified businesses are never overwritten.
 * Outcome is recorded in an import_jobs row (RUNNING → DONE).
 */
import "./_shared";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import * as t from "@/db/schema";
import { LEAF_CATEGORY_SLUGS } from "@/lib/constants";
import { duplicateConfidence, DUPLICATE_THRESHOLD, normalizeBusinessName, normalizePhone } from "@/lib/normalize";
import { slugify } from "@/lib/utils";

import {
  closeDb,
  findNearbyBusinesses,
  getArg,
  hasFlag,
  loadCategoryIdBySlug,
  recomputeAggregates,
} from "./_shared";

/* ───────────────────────────── CSV parser ────────────────────────────────── */

/**
 * Minimal RFC-4180-ish CSV parser (no deps). Handles quoted fields, escaped
 * quotes (""), commas and newlines inside quotes. Returns rows of string cells.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Strip a leading UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      // Handle CRLF: skip the \n that follows a \r.
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      // Skip fully-empty lines.
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  // Flush trailing field/row (no final newline).
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

/** Turn parsed rows into objects keyed by header. */
function toRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((cells) => {
    const rec: Record<string, string> = {};
    header.forEach((key, idx) => {
      rec[key] = (cells[idx] ?? "").trim();
    });
    return rec;
  });
}

/* ─────────────────────────── Row validation ──────────────────────────────── */

const opt = (v: unknown) => (v === "" || v == null ? undefined : v);

const rowSchema = z.object({
  name: z.string().trim().min(2).max(255),
  category_slug: z
    .string()
    .trim()
    .refine((s) => LEAF_CATEGORY_SLUGS.includes(s), "Буруу ангилал"),
  phone: z.preprocess(opt, z.string().max(40).optional()),
  website: z.preprocess(opt, z.string().url().optional()),
  address: z.preprocess(opt, z.string().max(500).optional()),
  district: z.preprocess(opt, z.string().max(80).optional()),
  khoroo: z.preprocess(opt, z.string().max(40).optional()),
  lat: z.preprocess(opt, z.coerce.number().min(-90).max(90).optional()),
  lng: z.preprocess(opt, z.coerce.number().min(-180).max(180).optional()),
  description: z.preprocess(opt, z.string().max(5000).optional()),
  price_level: z.preprocess(opt, z.coerce.number().int().min(1).max(4).optional()),
});

type CsvRow = z.infer<typeof rowSchema>;

/* ──────────────────────────────── main ───────────────────────────────────── */

async function main(): Promise<void> {
  const dryRun = hasFlag("dry-run");
  const fileArg = getArg("file") ?? "sample.csv";
  const filePath = resolve(process.cwd(), "scripts", "data", fileArg);

  console.log(`📄 CSV импорт${dryRun ? " (dry-run)" : ""} — ${filePath}`);

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    throw new Error(`Файл олдсонгүй: ${filePath}`);
  }

  const records = toRecords(parseCsv(raw));
  console.log(`  ✓ ${records.length} мөр уншлаа.`);

  let jobId: string | null = null;
  if (!dryRun) {
    const [job] = await db
      .insert(t.importJobs)
      .values({ source: "csv", fileName: fileArg, status: "RUNNING", totalRows: records.length })
      .returning({ id: t.importJobs.id });
    jobId = job!.id;
  }

  const counts = { total: records.length, inserted: 0, duplicates: 0, errors: 0 };
  const errLog: string[] = [];

  try {
    const catBySlug = await loadCategoryIdBySlug();

    for (let i = 0; i < records.length; i++) {
      const parsed = rowSchema.safeParse(records[i]);
      if (!parsed.success) {
        counts.errors++;
        const msg = `мөр ${i + 2}: ${parsed.error.issues.map((e) => `${e.path.join(".")} ${e.message}`).join("; ")}`;
        errLog.push(msg);
        console.warn(`  ⚠ ${msg}`);
        continue;
      }
      const row: CsvRow = parsed.data;

      // Dedupe (only meaningful when coordinates are present).
      if (row.lat != null && row.lng != null) {
        const nearby = await findNearbyBusinesses(row.lat, row.lng, 150);
        let bestScore = 0;
        for (const cand of nearby) {
          const score = duplicateConfidence(
            { name: row.name, phone: row.phone ?? null, lat: row.lat, lng: row.lng, categorySlug: row.category_slug },
            { name: cand.name, phone: cand.phone, lat: cand.lat, lng: cand.lng, categorySlug: cand.categorySlug },
          );
          if (score > bestScore) bestScore = score;
        }
        if (bestScore >= DUPLICATE_THRESHOLD) {
          counts.duplicates++;
          console.log(`  ~ давхардсан (${bestScore.toFixed(2)}): ${row.name}`);
          continue;
        }
      }

      if (dryRun) {
        counts.inserted++;
        console.log(`  + [dry] ${row.name} → ${row.category_slug}`);
        continue;
      }

      let slug = slugify(row.name);
      const slugTaken = await db
        .select({ id: t.businesses.id })
        .from(t.businesses)
        .where(eq(t.businesses.slug, slug))
        .limit(1);
      if (slugTaken[0]) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

      const [biz] = await db
        .insert(t.businesses)
        .values({
          name: row.name,
          normalizedName: normalizeBusinessName(row.name),
          slug,
          description: row.description ?? null,
          primaryCategoryId: catBySlug.get(row.category_slug) ?? null,
          priceLevel: row.price_level ?? null,
          status: "ACTIVE",
          source: "csv",
          sourceId: `${fileArg}#${i + 2}`,
          confidenceScore: 1,
          publishedAt: new Date(),
        })
        .returning({ id: t.businesses.id });
      const businessId = biz!.id;

      await db.insert(t.businessLocations).values({
        businessId,
        addressText: row.address ?? null,
        district: row.district ?? null,
        khoroo: row.khoroo ?? null,
        latitude: row.lat ?? null,
        longitude: row.lng ?? null,
      });

      if (row.phone || row.website) {
        await db.insert(t.businessContacts).values({
          businessId,
          phone: normalizePhone(row.phone) ?? row.phone ?? null,
          website: row.website ?? null,
        });
      }

      counts.inserted++;
      console.log(`  + ${row.name} → ${row.category_slug}`);
    }

    if (jobId) {
      await db
        .update(t.importJobs)
        .set({
          status: "DONE",
          inserted: counts.inserted,
          duplicates: counts.duplicates,
          errors: counts.errors,
          log: { errors: errLog.slice(0, 50) },
          finishedAt: new Date(),
        })
        .where(eq(t.importJobs.id, jobId));

      console.log("→ Нэгтгэсэн үзүүлэлтүүдийг дахин тооцоолж байна…");
      await recomputeAggregates();
    }

    console.log(
      `\n✅ Дууслаа${dryRun ? " (dry-run)" : ""}: ${counts.inserted} нэмсэн, ` +
        `${counts.duplicates} давхардсан, ${counts.errors} алдаатай.`,
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
    console.error("\n❌ CSV импорт алдаа:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
    process.exit(process.exitCode ?? 0);
  });
