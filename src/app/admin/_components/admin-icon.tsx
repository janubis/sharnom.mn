import {
  type LucideIcon,
  type LucideProps,
  LayoutDashboard,
  Store,
  MessageSquare,
  Image,
  Users,
  FolderTree,
  BadgeCheck,
  Flag,
  BarChart3,
  Upload,
  Shield,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Store,
  MessageSquare,
  Image,
  Users,
  FolderTree,
  BadgeCheck,
  Flag,
  BarChart3,
  Upload,
  Shield,
};

/** Resolve an admin nav icon by name with a neutral fallback. */
export function AdminIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ICONS[name] ?? Shield;
  return <Icon {...props} />;
}
