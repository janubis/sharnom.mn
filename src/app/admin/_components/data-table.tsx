"use client";

import * as React from "react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

export type DataTableColumn<T> = {
  /** Stable key (also used for cell React key). */
  key: string;
  header: React.ReactNode;
  /** Cell renderer. */
  cell: (row: T) => React.ReactNode;
  /** Tailwind classes for the cell/header (width, alignment, hiding). */
  className?: string;
  /** Hide on small screens. */
  hideBelow?: "sm" | "md" | "lg";
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Unique id accessor for keys + selection. */
  getRowId: (row: T) => string;
  loading?: boolean;
  /** Number of skeleton rows while loading. */
  skeletonRows?: number;
  /** Enable row selection (renders a checkbox column). */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Empty state copy. */
  emptyTitle?: string;
  emptyDescription?: string;
  /** Optional click handler for a row (e.g. open detail). */
  onRowClick?: (row: T) => void;
  className?: string;
};

const HIDE_CLASS: Record<NonNullable<DataTableColumn<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

/**
 * Column-driven admin table with a sticky header, optional selection, loading
 * skeletons and a friendly empty state. Pure presentation — data fetching and
 * mutations live in the page-level client containers.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading = false,
  skeletonRows = 8,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  emptyTitle = "Мэдээлэл алга",
  emptyDescription,
  onRowClick,
  className,
}: DataTableProps<T>) {
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = rows.length > 0 && rows.every((r) => selectedSet.has(getRowId(r)));
  const someSelected = rows.some((r) => selectedSet.has(getRowId(r)));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? [] : rows.map(getRowId));
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange([...next]);
  };

  const colCount = columns.length + (selectable ? 1 : 0);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-card",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <tr className="border-b border-border text-left">
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Бүгдийг сонгох"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 font-semibold text-muted-foreground",
                    col.hideBelow && HIDE_CLASS[col.hideBelow],
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-border/60">
                  {selectable && (
                    <td className="px-4 py-3.5">
                      <Skeleton className="size-4 rounded" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3.5",
                        col.hideBelow && HIDE_CLASS[col.hideBelow],
                      )}
                    >
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-16">
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <Inbox className="size-6" aria-hidden />
                    </span>
                    <p className="font-medium text-foreground">{emptyTitle}</p>
                    {emptyDescription && (
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        {emptyDescription}
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = getRowId(row);
                const selected = selectedSet.has(id);
                return (
                  <tr
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b border-border/60 transition-colors last:border-0",
                      selected ? "bg-primary/5" : "hover:bg-muted/40",
                      onRowClick && "cursor-pointer",
                    )}
                  >
                    {selectable && (
                      <td
                        className="px-4 py-3.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label="Мөр сонгох"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-3.5 align-middle text-foreground",
                          col.hideBelow && HIDE_CLASS[col.hideBelow],
                          col.className,
                        )}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
