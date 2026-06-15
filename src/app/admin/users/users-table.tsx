"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Ban, ShieldX, Undo2, Clock } from "lucide-react";

import type { AdminUserRow } from "@/db/queries/users";
import type { UserRole } from "@/db/schema";
import { isAdmin } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type DataTableColumn } from "../_components/data-table";
import { ConfirmDialog } from "../_components/confirm-dialog";
import { adminApi } from "../_components/admin-fetch";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "USER", label: "Хэрэглэгч" },
  { value: "OWNER", label: "Эзэн" },
  { value: "MODERATOR", label: "Модератор" },
  { value: "ADMIN", label: "Админ" },
  { value: "SUPER_ADMIN", label: "Супер админ" },
];

function initials(name: string | null, email: string): string {
  const base = name?.trim() || email.split("@")[0] || "";
  const parts = base.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function userStatus(u: AdminUserRow): {
  label: string;
  variant: "success" | "soyombo" | "warning";
} {
  if (u.bannedAt) return { label: "Хориглосон", variant: "soyombo" };
  if (u.suspendedUntil && u.suspendedUntil.getTime() > Date.now())
    return { label: "Түр хаасан", variant: "warning" };
  return { label: "Идэвхтэй", variant: "success" };
}

export function UsersTable({
  rows,
  currentRole,
  currentUserId,
}: {
  rows: AdminUserRow[];
  currentRole: UserRole;
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const admin = isAdmin(currentRole);
  const [banTarget, setBanTarget] = React.useState<AdminUserRow | null>(null);

  async function changeRole(id: string, role: UserRole) {
    try {
      await adminApi.patch(`/api/admin/users/${id}`, { role });
      toast({ title: "Эрх шинэчлэгдлээ", variant: "success" });
      router.refresh();
    } catch (e) {
      toast({ title: "Алдаа", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function moderate(id: string, action: "ban" | "suspend" | "unban", label: string) {
    try {
      await adminApi.post(`/api/admin/users/${id}`, { action });
      toast({ title: label, variant: "success" });
      router.refresh();
    } catch (e) {
      toast({ title: "Алдаа", description: (e as Error).message, variant: "destructive" });
    }
  }

  const columns: DataTableColumn<AdminUserRow>[] = [
    {
      key: "user",
      header: "Хэрэглэгч",
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            {u.image && <AvatarImage src={u.image} alt={u.name ?? ""} />}
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {initials(u.name, u.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {u.name ?? "Нэргүй"}
              {u.id === currentUserId && (
                <span className="ml-1.5 text-xs text-muted-foreground">(та)</span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "contributions",
      header: "Сэтгэгдэл",
      hideBelow: "md",
      cell: (u) => (
        <span className="text-sm tabular-nums text-muted-foreground">{u.reviewCount}</span>
      ),
    },
    {
      key: "status",
      header: "Төлөв",
      hideBelow: "sm",
      cell: (u) => {
        const s = userStatus(u);
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: "role",
      header: "Эрх",
      cell: (u) =>
        admin && u.id !== currentUserId ? (
          <Select value={u.role} onValueChange={(v) => changeRole(u.id, v as UserRole)}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline">
            {ROLES.find((r) => r.value === u.role)?.label ?? u.role}
          </Badge>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Үйлдэл</span>,
      className: "w-12 text-right",
      cell: (u) =>
        admin && u.id !== currentUserId ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Үйлдэл">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {u.bannedAt || (u.suspendedUntil && u.suspendedUntil.getTime() > Date.now()) ? (
                <DropdownMenuItem
                  onSelect={() => moderate(u.id, "unban", "Хориг цуцлагдлаа")}
                >
                  <Undo2 />
                  Хориг цуцлах
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem
                    onSelect={() => moderate(u.id, "suspend", "Түр хаалаа")}
                  >
                    <Clock />
                    7 хоног түр хаах
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => setBanTarget(u)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Ban />
                    Хориглох
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="inline-flex justify-end">
            <ShieldX className={cn("size-4 text-muted-foreground/40")} />
          </span>
        ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(u) => u.id}
        emptyTitle="Хэрэглэгч олдсонгүй"
      />
      <ConfirmDialog
        open={!!banTarget}
        onOpenChange={(o) => !o && setBanTarget(null)}
        title="Хэрэглэгчийг хориглох уу?"
        description={
          banTarget
            ? `${banTarget.name ?? banTarget.email}-г бүрмөсөн хориглоно. Дараа нь цуцлах боломжтой.`
            : undefined
        }
        destructive
        confirmLabel="Хориглох"
        onConfirm={async () => {
          if (banTarget) await moderate(banTarget.id, "ban", "Хориглолоо");
        }}
      />
    </>
  );
}
