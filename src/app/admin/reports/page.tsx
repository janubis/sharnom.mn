/**
 * Reports queue. Lists OPEN reports (by default) with resolve / dismiss actions.
 * Business + review reports are linked back to the admin business editor.
 */
import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { ReportStatus } from "@/db/schema";
import { PAGE_SIZE } from "@/lib/constants";
import { Pagination } from "@/components/common/pagination";
import { AdminPageHeader } from "../_components/page-header";
import { TableToolbar, type FilterOption } from "../_components/table-toolbar";
import { withParams } from "../_components/build-href";
import { ReportsList, type AdminReportRow } from "./reports-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Гомдол" };

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS_OPTIONS: FilterOption[] = [
  { value: "OPEN", label: "Нээлттэй" },
  { value: "RESOLVED", label: "Шийдвэрлэсэн" },
  { value: "DISMISSED", label: "Цуцалсан" },
];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

async function listReports(
  status: ReportStatus,
  page: number,
): Promise<{ items: AdminReportRow[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE;
  const rows = (await db.execute(sql`
    SELECT
      r.id, r.target_type, r.target_id, r.reason, r.detail, r.status, r.created_at,
      u.name AS reporter_name,
      COALESCE(b_direct.id, b_review.id) AS business_id,
      COALESCE(b_direct.name, b_review.name) AS business_name,
      COUNT(*) OVER() AS total
    FROM reports r
    LEFT JOIN users u ON u.id = r.reporter_user_id
    LEFT JOIN businesses b_direct
      ON r.target_type = 'BUSINESS' AND b_direct.id = r.target_id
    LEFT JOIN reviews rev ON r.target_type = 'REVIEW' AND rev.id = r.target_id
    LEFT JOIN businesses b_review ON b_review.id = rev.business_id
    WHERE r.status = ${status}
    ORDER BY r.created_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `)) as unknown as Array<{
    id: string;
    target_type: AdminReportRow["targetType"];
    target_id: string;
    reason: string;
    detail: string | null;
    status: ReportStatus;
    created_at: string | Date;
    reporter_name: string | null;
    business_id: string | null;
    business_name: string | null;
    total: number;
  }>;

  const total = rows.length > 0 ? Number(rows[0]!.total) : 0;
  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      detail: r.detail,
      status: r.status,
      createdAt: String(r.created_at),
      reporterName: r.reporter_name,
      businessId: r.business_id,
      businessName: r.business_name,
    })),
  };
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const status = (first(sp.status) as ReportStatus | undefined) ?? "OPEN";

  const { items, total } = await listReports(status, page);

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        title="Гомдол"
        description={`${total.toLocaleString("mn-MN")} гомдол`}
      >
        <TableToolbar
          search={false}
          selects={[{ param: "status", placeholder: "Нээлттэй", options: STATUS_OPTIONS }]}
        />
      </AdminPageHeader>

      <ReportsList reports={items} />

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        buildHref={(p) => withParams("/admin/reports", sp, { page: p })}
        className="mt-6"
      />
    </div>
  );
}
