/**
 * Admin business management — filterable, paginated table with row actions,
 * merge/duplicate tooling and bulk selection (ADMIN can delete).
 */
import { Plus } from "lucide-react";

import {
  listBusinessesForAdmin,
  type ListBusinessesForAdminParams,
} from "@/db/queries/businesses";
import { getCategoryTree } from "@/db/queries/categories";
import { auth } from "@/lib/auth";
import type {
  UserRole,
  BusinessStatus,
  VerificationStatus,
} from "@/db/schema";
import { PAGE_SIZE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/common/pagination";
import { AdminPageHeader } from "../_components/page-header";
import { TableToolbar, type FilterOption } from "../_components/table-toolbar";
import { withParams } from "../_components/build-href";
import { BusinessesTable } from "./businesses-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Бизнесүүд" };

type SearchParams = Record<string, string | string[] | undefined>;

const VERIFICATION_OPTIONS: FilterOption[] = [
  { value: "VERIFIED", label: "Баталгаажсан" },
  { value: "CLAIMED", label: "Эзэмшсэн" },
  { value: "UNVERIFIED", label: "Баталгаажаагүй" },
];

const STATUS_OPTIONS: FilterOption[] = [
  { value: "ACTIVE", label: "Идэвхтэй" },
  { value: "DRAFT", label: "Ноорог" },
  { value: "CLOSED", label: "Хаагдсан" },
  { value: "DUPLICATE", label: "Давхардсан" },
];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const role = (session?.user?.role ?? "MODERATOR") as UserRole;

  const page = Math.max(1, Number(first(sp.page)) || 1);
  const params: ListBusinessesForAdminParams = {
    q: first(sp.q),
    category: first(sp.category),
    verification: first(sp.verification) as VerificationStatus | undefined,
    status: first(sp.status) as BusinessStatus | undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const [{ items, total }, tree] = await Promise.all([
    listBusinessesForAdmin(params),
    getCategoryTree(),
  ]);

  // Flatten taxonomy into selectable options (parents + children).
  const categoryOptions: FilterOption[] = tree.flatMap((parent) => [
    { value: parent.slug, label: parent.nameMn },
    ...parent.children.map((c) => ({ value: c.slug, label: `— ${c.nameMn}` })),
  ]);

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        title="Бизнесүүд"
        description={`Нийт ${total.toLocaleString("mn-MN")} бизнес`}
        actions={
          <Button asChild variant="secondary">
            <a href="/owner/businesses/new">
              <Plus className="size-4" />
              Шинэ бизнес
            </a>
          </Button>
        }
      >
        <TableToolbar
          searchPlaceholder="Нэр эсвэл slug-аар хайх…"
          selects={[
            { param: "category", placeholder: "Бүх ангилал", options: categoryOptions },
            { param: "verification", placeholder: "Бүх баталгаа", options: VERIFICATION_OPTIONS },
            { param: "status", placeholder: "Бүх төлөв", options: STATUS_OPTIONS },
          ]}
        />
      </AdminPageHeader>

      <BusinessesTable rows={items} role={role} />

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        buildHref={(p) => withParams("/admin/businesses", sp, { page: p })}
        className="mt-6"
      />
    </div>
  );
}
