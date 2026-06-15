/**
 * Bulk-import pipeline for the admin importer.
 *
 * Accepts normalised business rows (from a CSV upload or JSON body) and inserts
 * the non-duplicate ones, reusing the same name/proximity de-duplication the
 * merge tool relies on. Every run records an `import_jobs` row with counters and
 * a per-row log so the admin UI can show outcomes. Heavy external fetches (OSM)
 * are intentionally NOT performed inline — they should be enqueued to a worker.
 */
import "server-only";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { importJobs } from "@/db/schema";
import type { ImportJob } from "@/db/schema";
import { LEAF_CATEGORY_SLUGS } from "@/lib/constants";
import { normalizeBusinessName, normalizePhone } from "@/lib/normalize";
import { createBusinessAdmin } from "./_lib";

/** One incoming import row. Loosely typed; coerced/validated per-row. */
export const importRowSchema = z.object({
  name: z.string().trim().min(2).max(255),
  description: z.string().max(5000).optional(),
  categorySlug: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().max(255).optional(),
  website: z.string().max(255).optional(),
  addressText: z.string().max(500).optional(),
  district: z.string().max(80).optional(),
  khoroo: z.string().max(40).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  priceLevel: z.coerce.number().int().min(1).max(4).optional(),
});

export type ImportRow = z.infer<typeof importRowSchema>;

export type ImportRowResult = {
  row: number;
  name: string;
  outcome: "inserted" | "duplicate" | "error";
  businessId?: string;
  reason?: string;
};

/** Minimal CSV parser (handles quoted fields + commas/newlines inside quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.some((c) => c.trim() !== "")) rows.push(record);
      record = [];
    } else field += ch;
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    if (record.some((c) => c.trim() !== "")) rows.push(record);
  }

  if (rows.length === 0) return [];
  const header = rows[0]!.map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      obj[key] = (cells[idx] ?? "").trim();
    });
    return obj;
  });
}

/** Is there already a likely-duplicate business for this row? */
async function findDuplicate(row: ImportRow): Promise<string | null> {
  const normalized = normalizeBusinessName(row.name);
  const phone = normalizePhone(row.phone);
  const hasGeo = row.latitude != null && row.longitude != null;

  const point = hasGeo
    ? sql`ST_SetSRID(ST_MakePoint(${row.longitude}, ${row.latitude}), 4326)::geography`
    : sql`NULL`;

  const dup = (await db.execute(sql`
    SELECT b.id
    FROM businesses b
    LEFT JOIN business_locations loc ON loc.business_id = b.id
    LEFT JOIN business_contacts ct ON ct.business_id = b.id
    WHERE b.status IN ('ACTIVE', 'DRAFT', 'DUPLICATE')
      AND (
        (b.normalized_name IS NOT NULL AND b.normalized_name = ${normalized})
        ${phone ? sql`OR regexp_replace(COALESCE(ct.phone, ''), '\\D', '', 'g') LIKE ${"%" + phone}` : sql``}
        ${hasGeo ? sql`OR (loc.geog IS NOT NULL AND ST_DWithin(loc.geog, ${point}, 50))` : sql``}
      )
    LIMIT 1
  `)) as unknown as Array<{ id: string }>;

  return dup[0]?.id ?? null;
}

export type ImportOptions = {
  source: string;
  fileName?: string | null;
  startedBy: string | null;
};

/**
 * Insert the provided rows (de-duplicated) and record an import_jobs row.
 * Returns the finished job. Validation/dup/insert failures are recorded
 * per-row rather than aborting the batch.
 */
export async function runImport(
  rawRows: unknown[],
  opts: ImportOptions,
): Promise<ImportJob> {
  const [job] = await db
    .insert(importJobs)
    .values({
      source: opts.source,
      fileName: opts.fileName ?? null,
      status: "RUNNING",
      totalRows: rawRows.length,
      startedBy: opts.startedBy,
    })
    .returning();

  const results: ImportRowResult[] = [];
  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  // Cache the set of valid leaf category slugs for fast membership tests.
  const validCategorySlugs = new Set(LEAF_CATEGORY_SLUGS);

  for (let i = 0; i < rawRows.length; i++) {
    const parsed = importRowSchema.safeParse(rawRows[i]);
    if (!parsed.success) {
      errors++;
      results.push({
        row: i + 1,
        name: String((rawRows[i] as { name?: unknown })?.name ?? ""),
        outcome: "error",
        reason: parsed.error.issues[0]?.message ?? "Буруу мөр",
      });
      continue;
    }
    const row = parsed.data;
    const categorySlug =
      row.categorySlug && validCategorySlugs.has(row.categorySlug)
        ? row.categorySlug
        : undefined;

    try {
      const dupId = await findDuplicate(row);
      if (dupId) {
        duplicates++;
        results.push({ row: i + 1, name: row.name, outcome: "duplicate", businessId: dupId });
        continue;
      }

      const biz = await createBusinessAdmin(
        {
          name: row.name,
          description: row.description,
          primaryCategorySlug: categorySlug,
          priceLevel: row.priceLevel ?? null,
          phone: row.phone,
          email: row.email,
          website: row.website,
          addressText: row.addressText,
          district: row.district,
          khoroo: row.khoroo,
          latitude: row.latitude,
          longitude: row.longitude,
        },
        { source: opts.source },
      );
      inserted++;
      results.push({ row: i + 1, name: row.name, outcome: "inserted", businessId: biz.id });
    } catch (e) {
      errors++;
      results.push({
        row: i + 1,
        name: row.name,
        outcome: "error",
        reason: (e as Error).message,
      });
    }
  }

  const [finished] = await db
    .update(importJobs)
    .set({
      status: "COMPLETED",
      inserted,
      duplicates,
      errors,
      log: { results: results.slice(0, 500) },
      finishedAt: new Date(),
    })
    .where(eq(importJobs.id, job!.id))
    .returning();

  return finished!;
}

/** Record a queued (no-op) job for heavy external sources like OSM. */
export async function enqueueExternalImport(
  source: string,
  startedBy: string | null,
): Promise<ImportJob> {
  const [job] = await db
    .insert(importJobs)
    .values({
      source,
      status: "QUEUED",
      startedBy,
      log: {
        note: "Гадаад эх сурвалжийн импортыг (OSM гэх мэт) арын ажилд (worker) дамжуулна. CLI: npm run import:osm",
      },
    })
    .returning();
  return job!;
}
