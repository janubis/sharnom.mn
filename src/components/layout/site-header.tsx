"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Menu,
  Search,
  LayoutGrid,
  Map as MapIcon,
  Plus,
  User as UserIcon,
  Heart,
  LayoutDashboard,
  Shield,
  LogOut,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { hasRole } from "@/lib/rbac";
import { APP_NAME } from "@/lib/constants";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Container } from "@/components/layout/container";

const PRIMARY_NAV = [
  { href: "/search?view=categories", label: "Ангилал", icon: LayoutGrid },
  { href: "/search?view=map", label: "Газрын зураг", icon: MapIcon },
];

function initials(name?: string | null, email?: string | null): string {
  const base = name?.trim() || email?.split("@")[0] || "";
  if (!base) return "?";
  const parts = base.split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function AuthArea({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  if (status === "loading") {
    return <div className="shimmer size-9 rounded-full bg-muted" />;
  }

  if (!session?.user) {
    return (
      <Button
        size="sm"
        onClick={() => {
          onNavigate?.();
          router.push(
            `/login?callbackUrl=${encodeURIComponent(pathname || "/")}`,
          );
        }}
      >
        Нэвтрэх
      </Button>
    );
  }

  const role = session.user.role;
  const user = session.user;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Хэрэглэгчийн цэс"
        >
          <Avatar className="size-9">
            {user.image && <AvatarImage src={user.image} alt={user.name ?? ""} />}
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials(user.name, user.email).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 text-foreground">
          <span className="truncate font-semibold">{user.name ?? "Хэрэглэгч"}</span>
          {user.email && (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" onClick={onNavigate}>
            <UserIcon />
            Профайл
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/saved" onClick={onNavigate}>
            <Heart />
            Хадгалсан
          </Link>
        </DropdownMenuItem>
        {hasRole(role, "OWNER") && (
          <DropdownMenuItem asChild>
            <Link href="/owner" onClick={onNavigate}>
              <LayoutDashboard />
              Бизнесийн самбар
            </Link>
          </DropdownMenuItem>
        )}
        {hasRole(role, "ADMIN") && (
          <DropdownMenuItem asChild>
            <Link href="/admin" onClick={onNavigate}>
              <Shield />
              Админ
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            onNavigate?.();
            void signOut({ callbackUrl: "/" });
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut />
          Гарах
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Image
        src="/logo.svg"
        alt=""
        width={32}
        height={32}
        className="size-8"
        priority
      />
      <span className="font-display text-lg font-bold tracking-tight text-foreground">
        {APP_NAME}
      </span>
    </Link>
  );
}

/**
 * Sticky top header: brand, compact search trigger, primary nav, "Бизнес
 * нэмэх", and an auth area (login button or avatar dropdown). Collapses to a
 * hamburger + Sheet on mobile. A thin ulzii divider sits under the bar.
 */
export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <Container className="flex h-16 items-center gap-3">
        <Brand />

        {/* Compact search trigger (desktop) */}
        <Link
          href="/search"
          className="ml-2 hidden flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm transition-colors hover:border-input md:flex lg:max-w-md"
        >
          <Search className="size-4" />
          Юу хайж байна?
        </Link>

        <div className="flex-1 md:hidden" />

        {/* Primary nav (desktop) */}
        <nav className="hidden items-center gap-1 lg:flex">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "gap-1.5 text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Add business (desktop) */}
        <Button asChild variant="secondary" size="sm" className="hidden md:inline-flex">
          <Link href="/owner/businesses/new">
            <Plus className="size-4" />
            Бизнес нэмэх
          </Link>
        </Button>

        {/* Auth (desktop) */}
        <div className="hidden md:block">
          <AuthArea />
        </div>

        {/* Mobile: search + hamburger */}
        <Link
          href="/search"
          aria-label="Хайх"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "md:hidden",
          )}
        >
          <Search className="size-5" />
        </Link>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Цэс">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-72 flex-col gap-6">
            <SheetTitle className="sr-only">Цэс</SheetTitle>
            <div className="flex items-center justify-between pr-8">
              <Brand onClick={closeMobile} />
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <AuthArea onNavigate={closeMobile} />
            </div>
            <nav className="flex flex-col gap-1">
              {PRIMARY_NAV.map((item) => (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <item.icon className="size-4 text-muted-foreground" />
                    {item.label}
                  </Link>
                </SheetClose>
              ))}
              <SheetClose asChild>
                <Link
                  href="/saved"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <Heart className="size-4 text-muted-foreground" />
                  Хадгалсан
                </Link>
              </SheetClose>
            </nav>
            <SheetClose asChild>
              <Button asChild variant="secondary" className="mt-auto">
                <Link href="/owner/businesses/new">
                  <Plus className="size-4" />
                  Бизнес нэмэх
                </Link>
              </Button>
            </SheetClose>
          </SheetContent>
        </Sheet>
      </Container>

      <div className="ulzii-rule" aria-hidden />
    </header>
  );
}
