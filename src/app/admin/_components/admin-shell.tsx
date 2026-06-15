"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu, Search, User as UserIcon, LogOut, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import type { UserRole } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AdminSidebar, type AdminSidebarProps } from "./admin-sidebar";

export type AdminUserInfo = {
  name: string | null;
  email: string | null;
  image: string | null;
  role: UserRole;
};

export type AdminShellProps = {
  user: AdminUserInfo;
  badges?: AdminSidebarProps["badges"];
  children: React.ReactNode;
};

const ROLE_LABEL: Record<UserRole, string> = {
  USER: "Хэрэглэгч",
  OWNER: "Эзэн",
  MODERATOR: "Модератор",
  ADMIN: "Админ",
  SUPER_ADMIN: "Супер админ",
};

function initials(name?: string | null, email?: string | null): string {
  const base = name?.trim() || email?.split("@")[0] || "";
  if (!base) return "?";
  const parts = base.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Admin chrome: fixed left sidebar (desktop) + Sheet drawer (mobile), and a
 * sticky topbar with global business search and the admin user menu.
 */
export function AdminShell({ user, badges, children }: AdminShellProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/admin/businesses?q=${encodeURIComponent(q)}` : "/admin/businesses");
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card lg:block">
        <AdminSidebar role={user.role} badges={badges} />
      </aside>

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" aria-label="Цэс">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Админ цэс</SheetTitle>
              <AdminSidebar
                role={user.role}
                badges={badges}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          {/* Global search */}
          <form onSubmit={submitSearch} className="relative flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Бизнес хайх…"
              className="rounded-full pl-9"
              aria-label="Админ хайлт"
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden text-muted-foreground sm:inline-flex"
            >
              <Link href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                Сайт
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label="Админ цэс"
                >
                  <Avatar className="size-9">
                    {user.image && <AvatarImage src={user.image} alt={user.name ?? ""} />}
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {initials(user.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-1 text-foreground">
                  <span className="truncate font-semibold">
                    {user.name ?? "Админ"}
                  </span>
                  {user.email && (
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {user.email}
                    </span>
                  )}
                  <Badge variant="outline" className="mt-1 w-fit">
                    {ROLE_LABEL[user.role]}
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <UserIcon />
                    Профайл
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => void signOut({ callbackUrl: "/" })}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut />
                  Гарах
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className={cn("mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8")}>
          {children}
        </main>
      </div>
    </div>
  );
}
