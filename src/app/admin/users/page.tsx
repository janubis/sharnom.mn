/**
 * User management (ADMIN only — gated by sidebar + this page). Search, filter by
 * role, change roles and ban/suspend users.
 */
import { redirect } from "next/navigation";

import {
  listUsersForAdmin,
  type ListUsersForAdminParams,
} from "@/db/queries/users";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import type { UserRole } from "@/db/schema";
import { PAGE_SIZE } from "@/lib/constants";
import { Pagination } from "@/components/common/pagination";
import { AdminPageHeader } from "../_components/page-header";
import { TableToolbar, type FilterOption } from "../_components/table-toolbar";
import { withParams } from "../_components/build-href";
import { UsersTable } from "./users-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Хэрэглэгчид" };

type SearchParams = Record<string, string | string[] | undefined>;

const ROLE_OPTIONS: FilterOption[] = [
  { value: "USER", label: "Хэрэглэгч" },
  { value: "OWNER", label: "Эзэн" },
  { value: "MODERATOR", label: "Модератор" },
  { value: "ADMIN", label: "Админ" },
  { value: "SUPER_ADMIN", label: "Супер админ" },
];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const role = (session?.user?.role ?? "MODERATOR") as UserRole;
  // User management is ADMIN-only.
  if (!isAdmin(role)) redirect("/admin");

  const sp = await searchParams;
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const params: ListUsersForAdminParams = {
    q: first(sp.q),
    role: first(sp.role) as UserRole | undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const { items, total } = await listUsersForAdmin(params);

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        title="Хэрэглэгчид"
        description={`Нийт ${total.toLocaleString("mn-MN")} хэрэглэгч`}
      >
        <TableToolbar
          searchPlaceholder="Нэр эсвэл и-мэйлээр хайх…"
          selects={[{ param: "role", placeholder: "Бүх эрх", options: ROLE_OPTIONS }]}
        />
      </AdminPageHeader>

      <UsersTable
        rows={items}
        currentRole={role}
        currentUserId={(session?.user?.id ?? "") as string}
      />

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        buildHref={(p) => withParams("/admin/users", sp, { page: p })}
        className="mt-6"
      />
    </div>
  );
}
