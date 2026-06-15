"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { adminApi } from "../_components/admin-fetch";

export type PendingPhoto = {
  id: string;
  scope: "business" | "review";
  imageUrl: string;
  caption: string | null;
  businessId: string;
  businessName: string;
  businessSlug: string;
  uploadedBy: string | null;
  createdAt: string;
};

export function PhotoGrid({ photos }: { photos: PendingPhoto[] }) {
  const router = useRouter();
  const { toast } = useToast();
  // Track ids currently being mutated + locally resolved ones to fade out.
  const [pending, setPending] = React.useState<Record<string, "APPROVED" | "REJECTED">>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  async function moderate(photo: PendingPhoto, status: "APPROVED" | "REJECTED") {
    try {
      setBusy(photo.id);
      await adminApi.patch(`/api/admin/photos/${photo.id}`, {
        scope: photo.scope,
        status,
      });
      setPending((p) => ({ ...p, [photo.id]: status }));
      toast({
        title: status === "APPROVED" ? "Зөвшөөрлөө" : "Татгалзлаа",
        variant: "success",
      });
      // Refresh in the background so counts/badges update.
      router.refresh();
    } catch (e) {
      toast({
        title: "Алдаа",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  const visible = photos.filter((p) => !pending[p.id]);

  if (visible.length === 0) {
    return (
      <EmptyState
        title="Хүлээгдэж буй зураг алга"
        description="Бүх зураг шалгагдсан байна."
        compact
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {visible.map((photo) => (
        <div
          key={`${photo.scope}-${photo.id}`}
          className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-card-hover"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.imageUrl}
              alt={photo.caption ?? photo.businessName}
              className="size-full object-cover"
              loading="lazy"
            />
            <Badge
              variant={photo.scope === "review" ? "secondary" : "default"}
              className="absolute left-2 top-2"
            >
              {photo.scope === "review" ? "Сэтгэгдэл" : "Бизнес"}
            </Badge>
          </div>
          <div className="space-y-2 p-3">
            <Link
              href={`/admin/businesses/${photo.businessId}`}
              className="flex items-center gap-1 truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
            >
              {photo.businessName}
              <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
            </Link>
            {photo.caption && (
              <p className="line-clamp-1 text-xs text-muted-foreground">{photo.caption}</p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-success/40 text-success hover:bg-success/10"
                disabled={busy === photo.id}
                onClick={() => moderate(photo, "APPROVED")}
              >
                {busy === photo.id ? (
                  <Loader2 className={cn("size-4 animate-spin")} />
                ) : (
                  <Check className="size-4" />
                )}
                Зөвшөөрөх
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-soyombo/40 text-soyombo hover:bg-soyombo/10"
                disabled={busy === photo.id}
                onClick={() => moderate(photo, "REJECTED")}
              >
                <X className="size-4" />
                Татгалзах
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
