/**
 * /api/admin/imports
 *   POST — run a bulk import (ADMIN+). Accepts either:
 *            • multipart/form-data with a `file` (CSV) + optional `source`
 *            • JSON  { source, rows: [...] }            (parse + insert)
 *            • JSON  { source: "osm" }                  (enqueue, no-op inline)
 *   GET  — recent import_jobs (ADMIN+).
 */
import "server-only";

import { NextRequest } from "next/server";
import { desc } from "drizzle-orm";

import { db } from "@/db";
import { importJobs } from "@/db/schema";
import { auditLog } from "@/db/queries/users";
import { ok, fail, handleError } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { invalidate, cacheKeys } from "@/lib/redis";
import { actorContext } from "../_lib";
import { enqueueExternalImport, parseCsv, runImport } from "../_import";

export const dynamic = "force-dynamic";

const MAX_ROWS = 5000;

export async function GET() {
  try {
    await requireRole("ADMIN");
    const jobs = await db.query.importJobs.findMany({
      orderBy: [desc(importJobs.startedAt)],
      limit: 50,
    });
    return ok({ jobs });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("ADMIN");
    const { actorId, ip } = await actorContext(actor);
    const contentType = req.headers.get("content-type") ?? "";

    let source = "csv";
    let fileName: string | null = null;
    let rows: unknown[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      source = (form.get("source") as string) || "csv";
      if (!(file instanceof File)) return fail("CSV файл шаардлагатай", 422);
      fileName = file.name;
      const text = await file.text();
      rows = parseCsv(text);
    } else {
      const body = (await req.json()) as {
        source?: string;
        rows?: unknown[];
      };
      source = body.source || "csv";

      // External-source trigger (OSM / open-data): enqueue rather than fetch inline.
      if (source === "osm" || source === "open-data") {
        const job = await enqueueExternalImport(source, actorId || null);
        await auditLog(actorId, "import.enqueue", "import_job", job.id, null, { source }, ip);
        return ok({ job, enqueued: true }, { status: 202 });
      }

      rows = Array.isArray(body.rows) ? body.rows : [];
    }

    if (rows.length === 0) return fail("Импортлох мөр алга байна", 422);
    if (rows.length > MAX_ROWS) {
      return fail(`Нэг удаад дээд тал нь ${MAX_ROWS} мөр импортлоно. CLI скрипт ашиглана уу`, 422);
    }

    const job = await runImport(rows, { source, fileName, startedBy: actorId || null });

    await auditLog(
      actorId,
      "import.run",
      "import_job",
      job.id,
      null,
      { source, totalRows: job.totalRows, inserted: job.inserted, duplicates: job.duplicates, errors: job.errors },
      ip,
    );
    if (job.inserted > 0) await invalidate(cacheKeys.homeFeed());

    return ok({ job });
  } catch (e) {
    return handleError(e);
  }
}
