"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, CornerDownRight } from "lucide-react";

import type { CategoryNode } from "@/db/queries/categories";
import type { Category } from "@/db/schema";
import { slugify } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryGlyph } from "@/components/business/category-icon";
import { ConfirmDialog } from "../_components/confirm-dialog";
import { adminApi } from "../_components/admin-fetch";
import { IconPicker } from "./icon-picker";

const ROOT = "__root__";

type DialogState =
  | { mode: "create"; parentId: string | null }
  | { mode: "edit"; category: Category };

export function CategoryManager({ tree }: { tree: CategoryNode[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialog, setDialog] = React.useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);

  const parentChoices = tree.map((p) => ({ id: p.id, label: p.nameMn }));

  function CategoryRow({
    category,
    isChild,
  }: {
    category: Category;
    isChild?: boolean;
  }) {
    return (
      <div
        className={cnRow(isChild)}
      >
        {isChild && (
          <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground/50" />
        )}
        <CategoryGlyph name={category.icon ?? undefined} className="size-4 shrink-0 text-primary" />
        <span className="truncate text-sm font-medium text-foreground">
          {category.nameMn}
        </span>
        <span className="truncate text-xs text-muted-foreground">/{category.slug}</span>
        {category.businessCount > 0 && (
          <Badge variant="outline" className="shrink-0">
            {category.businessCount}
          </Badge>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {!isChild && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Дэд ангилал нэмэх"
              onClick={() => setDialog({ mode: "create", parentId: category.id })}
            >
              <Plus className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Засах"
            onClick={() => setDialog({ mode: "edit", category })}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            aria-label="Устгах"
            onClick={() => setDeleteTarget(category)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialog({ mode: "create", parentId: null })}>
          <Plus className="size-4" />
          Үндсэн ангилал
        </Button>
      </div>

      <div className="space-y-3">
        {tree.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Ангилал алга. Эхний ангиллаа нэмнэ үү.
          </Card>
        )}
        {tree.map((parent) => (
          <Card key={parent.id} className="overflow-hidden">
            <CategoryRow category={parent} />
            {parent.children.length > 0 && (
              <div className="border-t border-border/60">
                {parent.children.map((child) => (
                  <CategoryRow key={child.id} category={child} isChild />
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {dialog && (
        <CategoryDialog
          state={dialog}
          parentChoices={parentChoices}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Ангилал устгах уу?"
        description={
          deleteTarget
            ? `"${deleteTarget.nameMn}"-г устгана. Холбоотой бизнесүүдийн ангилал хоосрох болно.`
            : undefined
        }
        destructive
        confirmLabel="Устгах"
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await adminApi.del(`/api/admin/categories/${deleteTarget.id}`);
            toast({ title: "Устгагдлаа", variant: "success" });
            router.refresh();
          } catch (e) {
            toast({
              title: "Алдаа",
              description: (e as Error).message,
              variant: "destructive",
            });
          }
        }}
      />
    </>
  );
}

function cnRow(isChild?: boolean): string {
  return [
    "flex items-center gap-2 px-4 py-3",
    isChild ? "bg-muted/30 pl-8" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/* ── Create / edit dialog ──────────────────────────────────────────────────── */

function CategoryDialog({
  state,
  parentChoices,
  onClose,
  onSaved,
}: {
  state: DialogState;
  parentChoices: { id: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const editing = state.mode === "edit";
  const cat = editing ? state.category : null;

  const [nameMn, setNameMn] = React.useState(cat?.nameMn ?? "");
  const [nameEn, setNameEn] = React.useState(cat?.nameEn ?? "");
  const [slug, setSlug] = React.useState(cat?.slug ?? "");
  const [slugDirty, setSlugDirty] = React.useState(editing);
  const [icon, setIcon] = React.useState<string | null>(cat?.icon ?? "Store");
  const [parentId, setParentId] = React.useState<string>(
    cat?.parentId ?? (state.mode === "create" ? state.parentId ?? ROOT : ROOT),
  );
  const [sortOrder, setSortOrder] = React.useState(String(cat?.sortOrder ?? 0));
  const [saving, setSaving] = React.useState(false);

  // Auto-slug from English (or Mongolian) name until the user edits it.
  React.useEffect(() => {
    if (!slugDirty) setSlug(slugify(nameEn || nameMn));
  }, [nameEn, nameMn, slugDirty]);

  async function save() {
    if (!nameMn.trim() || !slug.trim()) {
      toast({ title: "Нэр болон slug шаардлагатай", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        nameMn: nameMn.trim(),
        nameEn: nameEn.trim() || undefined,
        slug: slug.trim(),
        parentId: parentId === ROOT ? null : parentId,
        icon: icon ?? undefined,
        sortOrder: Number(sortOrder) || 0,
      };
      if (editing && cat) {
        await adminApi.patch(`/api/admin/categories/${cat.id}`, body);
      } else {
        await adminApi.post("/api/admin/categories", body);
      }
      toast({ title: "Хадгалагдлаа", variant: "success" });
      onSaved();
    } catch (e) {
      toast({ title: "Алдаа", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Ангилал засах" : "Шинэ ангилал"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name-mn">Нэр (монгол)</Label>
              <Input
                id="cat-name-mn"
                value={nameMn}
                onChange={(e) => setNameMn(e.target.value)}
                maxLength={160}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-name-en">Нэр (англи)</Label>
              <Input
                id="cat-name-en"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                maxLength={160}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-slug">Slug</Label>
            <Input
              id="cat-slug"
              value={slug}
              onChange={(e) => {
                setSlugDirty(true);
                setSlug(e.target.value);
              }}
              pattern="[a-z0-9-]+"
              maxLength={160}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Эцэг ангилал</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT}>Үндсэн (эцэггүй)</SelectItem>
                  {parentChoices
                    .filter((p) => !cat || p.id !== cat.id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-sort">Эрэмбэ</Label>
              <Input
                id="cat-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Дүрс</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Болих
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Хадгалах
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
