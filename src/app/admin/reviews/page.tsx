/**
 * Review moderation queue — filter by status / reported, with approve / hide /
 * delete actions and a spam-score signal.
 */
import {
  listReviewsForAdmin,
  type ListReviewsForAdminParams,
} from "@/db/queries/reviews";
import { auth } from "@/lib/auth";
import type { ReviewStatus, UserRole } from "@/db/schema";
import { PAGE_SIZE } from "@/lib/constants";
import { Pagination } from "@/components/common/pagination";
import { AdminPageHeader } from "../_components/page-header";
import { TableToolbar, type FilterOption } from "../_components/table-toolbar";
import { withParams } from "../_components/build-href";
import { ReviewsTable } from "./reviews-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Сэтгэгдлүүд" };

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS_OPTIONS: FilterOption[] = [
  { value: "PUBLISHED", label: "Нийтлэгдсэн" },
  { value: "PENDING", label: "Хүлээгдэж буй" },
  { value: "HIDDEN", label: "Нуусан" },
  { value: "DELETED", label: "Устгасан" },
];

const REPORTED_OPTIONS: FilterOption[] = [
  { value: "1", label: "Гомдолтой" },
];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const role = (session?.user?.role ?? "MODERATOR") as UserRole;

  const page = Math.max(1, Number(first(sp.page)) || 1);
  const params: ListReviewsForAdminParams = {
    status: first(sp.status) as ReviewStatus | undefined,
    reported: first(sp.reported) === "1",
    page,
    pageSize: PAGE_SIZE,
  };

  const { items, total } = await listReviewsForAdmin(params);

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        title="Сэтгэгдлүүд"
        description={`Нийт ${total.toLocaleString("mn-MN")} сэтгэгдэл`}
      >
        <TableToolbar
          search={false}
          selects={[
            { param: "status", placeholder: "Бүх төлөв", options: STATUS_OPTIONS },
            { param: "reported", placeholder: "Бүгд", options: REPORTED_OPTIONS },
          ]}
        />
      </AdminPageHeader>

      <ReviewsTable rows={items} role={role} />

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        buildHref={(p) => withParams("/admin/reviews", sp, { page: p })}
        className="mt-6"
      />
    </div>
  );
}
