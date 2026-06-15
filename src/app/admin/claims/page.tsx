/**
 * Business-claim approval queue. View applicant evidence/note and approve or
 * reject with an admin note.
 */
import {
  listClaimsForAdmin,
  type ClaimStatus,
  type ListClaimsForAdminParams,
} from "@/db/queries/claims";
import { PAGE_SIZE } from "@/lib/constants";
import { Pagination } from "@/components/common/pagination";
import { AdminPageHeader } from "../_components/page-header";
import { TableToolbar, type FilterOption } from "../_components/table-toolbar";
import { withParams } from "../_components/build-href";
import { ClaimsList } from "./claims-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Эзэмших хүсэлт" };

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS_OPTIONS: FilterOption[] = [
  { value: "PENDING", label: "Хүлээгдэж буй" },
  { value: "APPROVED", label: "Зөвшөөрсөн" },
  { value: "REJECTED", label: "Татгалзсан" },
];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(first(sp.page)) || 1);
  // Default to the pending queue when no filter is chosen.
  const statusParam = (first(sp.status) as ClaimStatus | undefined) ?? "PENDING";

  const params: ListClaimsForAdminParams = {
    status: statusParam,
    page,
    pageSize: PAGE_SIZE,
  };

  const { items, total } = await listClaimsForAdmin(params);

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        title="Эзэмших хүсэлт"
        description={`${total.toLocaleString("mn-MN")} хүсэлт`}
      >
        <TableToolbar
          search={false}
          selects={[
            { param: "status", placeholder: "Хүлээгдэж буй", options: STATUS_OPTIONS },
          ]}
        />
      </AdminPageHeader>

      <ClaimsList claims={items} />

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        buildHref={(p) => withParams("/admin/claims", sp, { page: p })}
        className="mt-6"
      />
    </div>
  );
}
