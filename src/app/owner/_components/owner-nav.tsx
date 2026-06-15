"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Store,
  MessageSquare,
  ShieldCheck,
  Menu,
  ArrowLeft,
  LogOut,
  User as UserIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
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

const OWNER_NAV = [
  { href: "/owner", label: "Самбар", icon: LayoutDashboard, exact: true },
  { href: "/owner/businesses", label: "Миний бизнесүүд", icon: Store, exact: false },
  { href: "/owner/reviews", label: "Сэтгэгдэл", icon: MessageSquare, exact: false },
  { href: "/owner/claim", label: "Бизнес эзэмших", icon: ShieldCheck, exact: false },
] as const;

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name?: string | null, email?: string | null): string {
  const base = name?.trim() || email?.split("@")[0] || "";
  if (!base) return "?";
  const parts = base.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Brand mark linking back to the owner dashboard home. */
function OwnerBrand({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/owner"
      onClick={onClick}
      className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Image src="/logo.svg" alt="" width={32} height={32} className="size-8" priority />
      <span className="flex flex-col leading-none">
        <span className="font-display text-base font-bold tracking-tight text-foreground">
          {APP_NAME}
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">
          Бизнесийн самбар
        </span>
      </span>
    </Link>
  );
}

/** The shared link list, used in both the desktop sidebar and the mobile sheet. */
function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {OWNER_NAV.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
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
            <item.icon
              className={cn(
                "size-[18px] shrink-0",
                active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Хэрэглэгчийн цэс"
        >
          <Avatar className="size-9">
            {user?.image && <AvatarImage src={user.image} alt={user.name ?? ""} />}
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 text-foreground">
          <span className="truncate font-semibold">{user?.name ?? "Хэрэглэгч"}</span>
          {user?.email && (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserIcon />
            Профайл
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/">
            <ArrowLeft />
            Сайт руу буцах
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
  );
}

/** Desktop sidebar — fixed column with brand, nav and a back-to-site footer. */
export function OwnerSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-16 items-center px-5">
        <OwnerBrand />
      </div>
      <div className="ulzii-rule" aria-hidden />
      <div className="flex-1 overflow-y-auto p-3">
        <NavLinks />
      </div>
      <div className="border-t border-border p-3">
        <Button asChild variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Сайт руу буцах
          </Link>
        </Button>
      </div>
    </aside>
  );
}

/** Sticky topbar — mobile menu trigger, back-to-site link and user menu. */
export function OwnerTopbar() {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6">
      {/* Mobile menu */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="ghost" size="icon" aria-label="Цэс">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col gap-6">
          <SheetTitle className="sr-only">Бизнесийн самбарын цэс</SheetTitle>
          <OwnerBrand onClick={() => setOpen(false)} />
          <div className="ulzii-rule" aria-hidden />
          <NavLinks onNavigate={() => setOpen(false)} />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mt-auto w-full justify-start text-muted-foreground"
          >
            <Link href="/" onClick={() => setOpen(false)}>
              <ArrowLeft className="size-4" />
              Сайт руу буцах
            </Link>
          </Button>
        </SheetContent>
      </Sheet>

      <Link
        href="/"
        className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex lg:hidden"
      >
        <ArrowLeft className="size-4" />
        Сайт
      </Link>

      <div className="lg:hidden">
        <OwnerBrand />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
          <Link href="/owner/claim">
            <ShieldCheck className="size-4" />
            Бизнес эзэмших
          </Link>
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
