"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  GitMerge,
  Copy,
  ExternalLink,
  Star,
  Loader2,
} from "lucide-react";

import type { AdminBusinessRow, DuplicateCandidate } from "@/db/queries/businesses";
import type { UserRole } from "@/db/schema";
import { isAdmin } from "@/lib/rbac";
import { formatRating, formatDistance } from "@/lib/utils";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type DataTableColumn } from "../_components/data-table";
import { ConfirmDialog } from "../_components/confirm-dialog";
import { BusinessStatusBadge, VerificationBadge } from "../_components/status-badge";
import { adminApi } from "../_components/admin-fetch";

export type BusinessesTableProps = {
  rows: AdminBusinessRow[];
  role: UserRole;
};

export function BusinessesTable({ rows, role }: BusinessesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const admin = isAdmin(role);

  const [selected, setSelected] = React.useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminBusinessRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [mergeFor, setMergeFor] = React.useState<AdminBusinessRow | null>(null);

  async function deleteBusiness(id: string) {
    await adminApi.del(`/api/admin/businesses/${id}`);
    toast({ title: "Бизнес устгагдлаа", variant: "success" });
    router.refresh();
  }

  async function bulkDelete() {
    await Promise.all(selected.map((id) => adminApi.del(`/api/admin/businesses/${id}`)));
    toast({
      title: `${selected.length} бизнес устгагдлаа`,
      variant: "success",
    });
    setSelected([]);
    router.refresh();
  }

  const columns: DataTableColumn<AdminBusinessRow>[] = [
    {
      key: "name",
      header: "Нэр",
      cell: (b) => (
        <div className="min-w-0">
          <Link
            href={`/admin/businesses/${b.id}`}
            className="block max-w-[260px] truncate font-medium text-foreground hover:text-primary hover:underline"
          >
            {b.name}
          </Link>
          <span className="text-xs text-muted-foreground">/{b.slug}</span>
        </div>
      ),
    },
    {
      key: "category",
      header: "Ангилал",
      hideBelow: "md",
      cell: (b) =>
        b.categoryName ? (
          <span className="text-sm text-foreground">{b.categoryName}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "district",
      header: "Дүүрэг",
      hideBelow: "lg",
      cell: (b) => (
        <span className="text-sm text-muted-foreground">{b.district ?? "—"}</span>
      ),
    },
    {
      key: "rating",
      header: "Үнэлгээ",
      hideBelow: "sm",
      cell: (b) => (
        <span className="inline-flex items-center gap-1 text-sm">
          <Star className="size-3.5 fill-secondary text-secondary" />
          <span className="tabular-nums">{formatRating(b.ratingAvg)}</span>
          <span className="text-xs text-muted-foreground">({b.reviewCount})</span>
        </span>
      ),
    },
    {
      key: "verification",
      header: "Баталгаа",
      hideBelow: "md",
      cell: (b) => <VerificationBadge status={b.verificationStatus} />,
    },
    {
      key: "status",
      header: "Төлөв",
      cell: (b) => <BusinessStatusBadge status={b.status} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">Үйлдэл</span>,
      className: "w-12 text-right",
      cell: (b) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Үйлдэл"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem asChild>
              <Link href={`/admin/businesses/${b.id}`}>
                <Pencil />
                Засах
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/business/${b.slug}`} target="_blank">
                <ExternalLink />
                Нийтийн хуудас
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMergeFor(b)}>
              <GitMerge />
              Давхардал шалгах
            </DropdownMenuItem>
            {admin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setDeleteTarget(b)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 />
                  Устгах
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      {selected.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-card">
          <span className="text-sm font-medium text-foreground">
            {selected.length} сонгогдсон
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected([])}
            className="text-muted-foreground"
          >
            Болих
          </Button>
          {admin && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              className="ml-auto"
            >
              <Trash2 className="size-4" />
              Устгах
            </Button>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(b) => b.id}
        selectable={admin}
        selectedIds={selected}
        onSelectionChange={setSelected}
        emptyTitle="Бизнес олдсонгүй"
        emptyDescription="Шүүлтүүрээ өөрчилж дахин оролдоно уу."
      />

      {/* Single delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Бизнес устгах уу?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}"-г устгана. Энэ үйлдлийг буцаах боломжтой (зөөлөн устгал).`
            : undefined
        }
        destructive
        confirmLabel="Устгах"
        onConfirm={async () => {
          if (deleteTarget) {
            try {
              await deleteBusiness(deleteTarget.id);
            } catch (e) {
              toast({
                title: "Алдаа",
                description: (e as Error).message,
                variant: "destructive",
              });
            }
          }
        }}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`${selected.length} бизнес устгах уу?`}
        description="Сонгосон бүх бизнесийг устгана."
        destructive
        confirmLabel="Устгах"
        onConfirm={async () => {
          try {
            await bulkDelete();
          } catch (e) {
            toast({
              title: "Алдаа",
              description: (e as Error).message,
              variant: "destructive",
            });
          }
        }}
      />

      {/* Merge / duplicates */}
      <MergeDialog
        business={mergeFor}
        onOpenChange={(o) => !o && setMergeFor(null)}
        onMerged={() => {
          setMergeFor(null);
          router.refresh();
        }}
      />
    </>
  );
}

/* ── Duplicate / merge dialog ──────────────────────────────────────────────── */

function MergeDialog({
  business,
  onOpenChange,
  onMerged,
}: {
  business: AdminBusinessRow | null;
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [candidates, setCandidates] = React.useState<DuplicateCandidate[]>([]);
  const [mergingId, setMergingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!business) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    adminApi
      .get<{ candidates: DuplicateCandidate[] }>(
        `/api/admin/businesses/${business.id}/duplicates`,
      )
      .then((data) => {
        if (!cancelled) setCandidates(data.candidates ?? []);
      })
      .catch((e) => {
        if (!cancelled)
          toast({
            title: "Давхардал ачаалж чадсангүй",
            description: (e as Error).message,
            variant: "destructive",
          });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [business, toast]);

  async function merge(duplicateId: string) {
    if (!business) return;
    try {
      setMergingId(duplicateId);
      await adminApi.post(`/api/admin/businesses/${business.id}/merge`, {
        duplicateId,
      });
      toast({ title: "Нэгтгэлээ", variant: "success" });
      onMerged();
    } catch (e) {
      toast({
        title: "Нэгтгэж чадсангүй",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setMergingId(null);
    }
  }

  const REASON_LABEL: Record<DuplicateCandidate["reason"], string> = {
    name: "Ижил нэр",
    proximity: "Ойролцоо байршил",
    both: "Нэр + байршил",
  };

  return (
    <Dialog open={!!business} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Давхардал нэгтгэх</DialogTitle>
          <DialogDescription>
            {business
              ? `"${business.name}"-той төстэй бизнесүүд. Нэгтгэхэд сэтгэгдэл, зураг энэ бизнес рүү шилжинэ.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : candidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Давхардал илрээгүй.
            </p>
          ) : (
            <ul className="space-y-2">
              {candidates.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {c.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{REASON_LABEL[c.reason]}</Badge>
                      {c.district && <span>{c.district}</span>}
                      {c.distanceMeters != null && (
                        <span>{formatDistance(c.distanceMeters)}</span>
                      )}
                      <span>{c.reviewCount} сэтгэгдэл</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => merge(c.id)}
                    disabled={mergingId !== null}
                  >
                    {mergingId === c.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    Энд нэгтгэх
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Хаах
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
