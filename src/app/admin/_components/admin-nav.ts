/**
 * Admin navigation model — shared by the desktop sidebar and the mobile sheet.
 * Each item declares the minimum role required to see it (MODERATOR by default;
 * a few admin-only sections require ADMIN).
 */
import type { UserRole } from "@/db/schema";

export type AdminNavItem = {
  href: string;
  label: string;
  /** lucide-react icon name. */
  icon: string;
  /** Minimum role to view this item. */
  minRole: UserRole;
  /** Match nested routes (e.g. /admin/businesses/[id]) for active state. */
  exact?: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Хяналтын самбар", icon: "LayoutDashboard", minRole: "MODERATOR", exact: true },
  { href: "/admin/businesses", label: "Бизнесүүд", icon: "Store", minRole: "MODERATOR" },
  { href: "/admin/reviews", label: "Сэтгэгдлүүд", icon: "MessageSquare", minRole: "MODERATOR" },
  { href: "/admin/photos", label: "Зургууд", icon: "Image", minRole: "MODERATOR" },
  { href: "/admin/users", label: "Хэрэглэгчид", icon: "Users", minRole: "ADMIN" },
  { href: "/admin/categories", label: "Ангилал", icon: "FolderTree", minRole: "ADMIN" },
  { href: "/admin/claims", label: "Эзэмших хүсэлт", icon: "BadgeCheck", minRole: "MODERATOR" },
  { href: "/admin/reports", label: "Гомдол", icon: "Flag", minRole: "MODERATOR" },
  { href: "/admin/analytics", label: "Аналитик", icon: "BarChart3", minRole: "MODERATOR" },
  { href: "/admin/imports", label: "Импорт", icon: "Upload", minRole: "ADMIN" },
];
