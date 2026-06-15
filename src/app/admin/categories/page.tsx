/**
 * Category taxonomy management (ADMIN only). Two-level tree CRUD with an icon
 * picker, parent assignment and sort order — all via dialogs.
 */
import { redirect } from "next/navigation";

import { getCategoryTree } from "@/db/queries/categories";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import type { UserRole } from "@/db/schema";
import { AdminPageHeader } from "../_components/page-header";
import { CategoryManager } from "./category-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ангилал" };

export default async function AdminCategoriesPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "MODERATOR") as UserRole;
  if (!isAdmin(role)) redirect("/admin");

  const tree = await getCategoryTree();
  const totalLeaves = tree.reduce((sum, p) => sum + p.children.length, 0);

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        title="Ангилал"
        description={`${tree.length} үндсэн · ${totalLeaves} дэд ангилал`}
      />
      <CategoryManager tree={tree} />
    </div>
  );
}
