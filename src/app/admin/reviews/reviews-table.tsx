"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  EyeOff,
  Trash2,
  Star,
  Flag,
  MoreHorizontal,
  ShieldAlert,
} from "lucide-react";

import type { AdminReviewRow } from "@/db/queries/reviews";
import type { ReviewStatus, UserRole } from "@/db/schema";
import { isAdmin } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type DataTableColumn } from "../_components/data-table";
import { ConfirmDialog } from "../_components/confirm-dialog";
import { ReviewStatusBadge } from "../_components/status-badge";
import { adminApi } from "../_components/admin-fetch";

function SpamScore({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const high = score >= 0.6;
  const mid = score >= 0.3 && score < 0.6;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        high ? "text-soyombo" : mid ? "text-warning-foreground" : "text-muted-foreground",
      )}
    >
      {high && <ShieldAlert className="size-3.5" />}
      {pct}%
    </span>
  );
}

export function ReviewsTable({
  rows,
  role,
}: {
  rows: AdminReviewRow[];
  role: UserRole;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const admin = isAdmin(role);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminReviewRow | null>(null);

  async function setStatus(id: string, status: ReviewStatus, label: string) {
    try {
      await adminApi.patch(`/api/admin/reviews/${id}`, { status });
      toast({ title: label, variant: "success" });
      router.refresh();
    } catch (e) {
      toast({
        title: "Алдаа",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  }

  const columns: DataTableColumn<AdminReviewRow>[] = [
    {
      key: "review",
      header: "Сэтгэгдэл",
      className: "max-w-[420px]",
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-0.5 text-sm font-semibold">
              <Star className="size-3.5 fill-secondary text-secondary" />
              {r.rating}
            </span>
            {r.title && (
              <span className="truncate text-sm font-medium text-foreground">
                {r.title}
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{r.body}</p>
        </div>
      ),
    },
    {
      key: "business",
      header: "Бизнес",
      hideBelow: "md",
      cell: (r) =>
        r.business ? (
          <Link
            href={`/admin/businesses/${r.business.id}`}
            className="block max-w-[160px] truncate text-sm text-foreground hover:text-primary hover:underline"
          >
            {r.business.name}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "user",
      header: "Хэрэглэгч",
      hideBelow: "lg",
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.user?.name ?? "Зочин"}
        </span>
      ),
    },
    {
      key: "spam",
      header: "Спам",
      hideBelow: "sm",
      cell: (r) => <SpamScore score={r.spamScore} />,
    },
    {
      key: "reports",
      header: "Гомдол",
      hideBelow: "sm",
      cell: (r) =>
        r.reportCount > 0 ? (
          <Badge variant="soyombo">
            <Flag className="size-3" />
            {r.reportCount}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Төлөв",
      cell: (r) => <ReviewStatusBadge status={r.status} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">Үйлдэл</span>,
      className: "w-12 text-right",
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Үйлдэл">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {r.status !== "PUBLISHED" && (
              <DropdownMenuItem
                onSelect={() => setStatus(r.id, "PUBLISHED", "Нийтэллээ")}
              >
                <Check />
                Зөвшөөрөх
              </DropdownMenuItem>
            )}
            {r.status !== "HIDDEN" && (
              <DropdownMenuItem onSelect={() => setStatus(r.id, "HIDDEN", "Нуулаа")}>
                <EyeOff />
                Нуух
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setDeleteTarget(r)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 />
              Устгах
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        emptyTitle="Сэтгэгдэл олдсонгүй"
        emptyDescription="Шүүлтүүрээ өөрчилнө үү."
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Сэтгэгдэл устгах уу?"
        description="Сэтгэгдэл устгагдаж, бизнесийн үнэлгээ дахин тооцогдоно."
        destructive
        confirmLabel="Устгах"
        onConfirm={async () => {
          if (deleteTarget) await setStatus(deleteTarget.id, "DELETED", "Устгалаа");
        }}
      />
    </>
  );
}
