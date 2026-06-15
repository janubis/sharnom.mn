/**
 * Data import console (ADMIN only). CSV upload + OSM import trigger + search
 * reindex live in the client ImportActions card row; below them is a server-
 * rendered log of the most recent import_jobs with their outcomes.
 */
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { Database } from "lucide-react";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import type { UserRole } from "@/db/schema";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { AdminPageHeader } from "../_components/page-header";
import { Panel } from "../_components/panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Импорт" };

type ImportJobRow = {
  id: string;
  source: string;
  fileName: string | null;
  status: string;
  totalRows: number;
  inserted: number;
  updated: number;
  duplicates: number;
  errors: number;
  startedByName: string | null;
  startedAt: string;
  finishedAt: string | null;
};

const STATUS_META: Record<
  string,
  { label: string; variant: "success" | "warning" | "soyombo" | "outline" | "secondary" }
> = {
  RUNNING: { label: "Ажиллаж байна", variant: "warning" },
  COMPLETED: { label: "Дууссан", variant: "success" },
  FAILED: { label: "Алдаатай", variant: "soyombo" },
  PARTIAL: { label: "Хэсэгчилсэн", variant: "secondary" },
};

const SOURCE_LABEL: Record<string, string> = {
  csv: "CSV",
  osm: "OpenStreetMap",
  "open-data": "Нээлттэй өгөгдөл",
};

async function listImportJobs(limit = 30): Promise<ImportJobRow[]> {
  const rows = (await db.execute(sql`
    SELECT
      j.id, j.source, j.file_name, j.status, j.total_rows,
      j.inserted, j.updated, j.duplicates, j.errors,
      u.name AS started_by_name,
      j.started_at, j.finished_at
    FROM import_jobs j
    LEFT JOIN users u ON u.id = j.started_by
    ORDER BY j.started_at DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    id: string;
    source: string;
    file_name: string | null;
    status: string;
    total_rows: number;
    inserted: number;
    updated: number;
    duplicates: number;
    errors: number;
    started_by_name: string | null;
    started_at: string | Date;
    finished_at: string | Date | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    fileName: r.file_name,
    status: r.status,
    totalRows: Number(r.total_rows),
    inserted: Number(r.inserted),
    updated: Number(r.updated),
    duplicates: Number(r.duplicates),
    errors: Number(r.errors),
    startedByName: r.started_by_name,
    startedAt: String(r.started_at),
    finishedAt: r.finished_at ? String(r.finished_at) : null,
  }));
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("mn-MN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminImportsPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "MODERATOR") as UserRole;
  // Imports are ADMIN-only.
  if (!isAdmin(role)) redirect("/admin");

  const jobs = await listImportJobs();

  // Import the client actions lazily-at-module-level (it's a normal client
  // component; the heavy Recharts is elsewhere, so a plain import is fine here).
  const { ImportActions } = await import("./import-actions");

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        title="Импорт"
        description="Бизнесийн өгөгдлийг CSV эсвэл OpenStreetMap-аас оруулах, хайлтын индексийг шинэчлэх."
      />

      <ImportActions />

      <div className="mt-6">
        <Panel
          title="Импортын түүх"
          description={`Сүүлийн ${jobs.length.toLocaleString("mn-MN")} ажил`}
          bodyClassName="px-0 pb-0"
        >
          {jobs.length === 0 ? (
            <EmptyState
              icon={Database}
              title="Импорт хийгдээгүй байна"
              description="Дээрх хэрэгслээр CSV эсвэл OSM импорт эхлүүлээрэй."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-5 py-2.5">Эх сурвалж</th>
                    <th className="px-3 py-2.5">Төлөв</th>
                    <th className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">
                      Нийт
                    </th>
                    <th className="px-3 py-2.5 text-right tabular-nums">Нэмсэн</th>
                    <th className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">
                      Шинэчилсэн
                    </th>
                    <th className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">
                      Давхардсан
                    </th>
                    <th className="px-3 py-2.5 text-right tabular-nums">Алдаа</th>
                    <th className="hidden px-3 py-2.5 lg:table-cell">Эхлүүлсэн</th>
                    <th className="px-5 py-2.5 text-right">Огноо</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => {
                    const meta = STATUS_META[j.status] ?? {
                      label: j.status,
                      variant: "outline" as const,
                    };
                    return (
                      <tr
                        key={j.id}
                        className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium text-foreground">
                            {SOURCE_LABEL[j.source] ?? j.source}
                          </div>
                          {j.fileName && (
                            <div className="truncate text-xs text-muted-foreground">
                              {j.fileName}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </td>
                        <td className="hidden px-3 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                          {j.totalRows.toLocaleString("mn-MN")}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-success">
                          {j.inserted.toLocaleString("mn-MN")}
                        </td>
                        <td className="hidden px-3 py-3 text-right tabular-nums text-muted-foreground md:table-cell">
                          {j.updated.toLocaleString("mn-MN")}
                        </td>
                        <td className="hidden px-3 py-3 text-right tabular-nums text-muted-foreground md:table-cell">
                          {j.duplicates.toLocaleString("mn-MN")}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-3 text-right tabular-nums",
                            j.errors > 0 ? "text-soyombo" : "text-muted-foreground",
                          )}
                        >
                          {j.errors.toLocaleString("mn-MN")}
                        </td>
                        <td className="hidden max-w-[140px] truncate px-3 py-3 text-muted-foreground lg:table-cell">
                          {j.startedByName ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                          {fmtDate(j.startedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
