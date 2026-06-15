"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { hasRole } from "@/lib/rbac";
import type { UserRole } from "@/db/schema";
import { APP_NAME } from "@/lib/constants";
import { ADMIN_NAV } from "./admin-nav";
import { AdminIcon } from "./admin-icon";

export type AdminSidebarProps = {
  role: UserRole;
  /** Pending-queue counts for badges. */
  badges?: { claims?: number; reports?: number; reviews?: number; photos?: number };
  /** Called when a link is clicked (used to close the mobile drawer). */
  onNavigate?: () => void;
};

function badgeFor(
  href: string,
  badges: AdminSidebarProps["badges"],
): number | undefined {
  if (!badges) return undefined;
  if (href === "/admin/claims") return badges.claims;
  if (href === "/admin/reports") return badges.reports;
  if (href === "/admin/reviews") return badges.reviews;
  if (href === "/admin/photos") return badges.photos;
  return undefined;
}

/** Left navigation: brand, role-filtered links with active state + count badges. */
export function AdminSidebar({ role, badges, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const items = ADMIN_NAV.filter((item) => hasRole(role, item.minRole));

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/admin"
        onClick={onNavigate}
        className="flex h-16 shrink-0 items-center gap-2 px-5"
      >
        <Image src="/logo.svg" alt="" width={28} height={28} className="size-7" />
        <div className="flex flex-col leading-tight">
          <span className="font-display text-sm font-bold tracking-tight text-foreground">
            {APP_NAME}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Админ
          </span>
        </div>
      </Link>

      <div className="ulzii-rule" aria-hidden />

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const count = badgeFor(item.href, badges);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <AdminIcon
                name={item.icon}
                className={cn(
                  "size-[18px] shrink-0",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                )}
                aria-hidden
              />
              <span className="flex-1 truncate">{item.label}</span>
              {count != null && count > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-soyombo px-1.5 text-[11px] font-semibold leading-5 text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="ulzii-rule" aria-hidden />
      <Link
        href="/"
        onClick={onNavigate}
        className="m-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        ← Сайт руу буцах
      </Link>
    </div>
  );
}
