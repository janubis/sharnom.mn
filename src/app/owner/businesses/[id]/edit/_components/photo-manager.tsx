"use client";

import * as React from "react";
import Image from "next/image";
import { Star, Trash2, UploadCloud, ImageIcon, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ManagedPhoto = {
  id: string;
  imageUrl: string;
  caption: string | null;
  isCover: boolean;
  status: string;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Owner photo manager: lists APPROVED/PENDING business photos, uploads new ones
 * via a presigned PUT then registers the keys, and lets the owner set a cover
 * or delete. All mutations hit the business photo endpoints.
 */
export function PhotoManager({
  businessId,
  initialPhotos,
}: {
  businessId: string;
  initialPhotos: ManagedPhoto[];
}) {
  const { toast } = useToast();
  const [photos, setPhotos] = React.useState<ManagedPhoto[]>(initialPhotos);
  const [uploading, setUploading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  /** Presign + PUT a single file, returning the stored object key. */
  async function uploadOne(file: File): Promise<string> {
    const presignRes = await fetch("/api/photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "business",
        targetId: businessId,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      }),
    });
    const presign = await presignRes.json();
    if (!presignRes.ok || !presign.ok) {
      throw new Error(presign.error ?? "Зураг бэлтгэхэд алдаа гарлаа");
    }

    const { url, key } = presign.data as { url: string; key: string };
    const putRes = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!putRes.ok) throw new Error("Зураг байршуулахад алдаа гарлаа");
    return key;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const selected = Array.from(files);
    for (const f of selected) {
      if (f.size > MAX_BYTES) {
        toast({
          variant: "destructive",
          title: "Зураг хэт том байна",
          description: `${f.name} — 8MB-аас бага байх ёстой.`,
        });
        return;
      }
    }

    setUploading(true);
    try {
      const keys: string[] = [];
      for (const f of selected) {
        keys.push(await uploadOne(f));
      }

      const res = await fetch(`/api/owner/businesses/${businessId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Зураг хадгалахад алдаа гарлаа");
      }

      // Server returns the newly created photo rows.
      const created = (data.data?.photos ?? []) as ManagedPhoto[];
      if (created.length > 0) {
        setPhotos((prev) => [...prev, ...created]);
      }
      toast({
        variant: "success",
        title: "Зураг нэмэгдлээ",
        description: "Шинэ зургууд модерацийн дараа нийтлэгдэнэ.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Алдаа гарлаа",
        description: (e as Error).message,
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function setCover(photoId: string) {
    setBusyId(photoId);
    try {
      const res = await fetch(`/api/owner/businesses/${businessId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, isCover: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Алдаа гарлаа");
      setPhotos((prev) =>
        prev.map((p) => ({ ...p, isCover: p.id === photoId })),
      );
      toast({ variant: "success", title: "Нүүр зураг тохирууллаа" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Алдаа гарлаа",
        description: (e as Error).message,
      });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(photoId: string) {
    setBusyId(photoId);
    try {
      const res = await fetch(`/api/owner/businesses/${businessId}/photos?photoId=${photoId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Алдаа гарлаа");
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      toast({ variant: "success", title: "Зураг устгагдлаа" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Алдаа гарлаа",
        description: (e as Error).message,
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Зургууд</CardTitle>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UploadCloud className="size-4" />
          )}
          Зураг нэмэх
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </CardHeader>
      <CardContent>
        {photos.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-12 text-sm text-muted-foreground transition-colors hover:border-input hover:bg-accent/40"
          >
            <ImageIcon className="size-8" />
            Зураг алга байна. Энд дарж нэмнэ үү.
          </button>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((p) => {
              const busy = busyId === p.id;
              return (
                <li
                  key={p.id}
                  className="group relative overflow-hidden rounded-xl border border-border bg-muted"
                >
                  <div className="relative aspect-square">
                    <Image
                      src={p.imageUrl}
                      alt={p.caption ?? ""}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover"
                    />
                    {p.isCover && (
                      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                        <Star className="size-3 fill-current" />
                        Нүүр
                      </span>
                    )}
                    {p.status === "PENDING" && (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-warning px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
                        Хүлээгдэж буй
                      </span>
                    )}
                    {busy && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <Loader2 className="size-5 animate-spin text-foreground" />
                      </div>
                    )}
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-between gap-1 p-1.5 opacity-0 transition-opacity",
                      "group-hover:opacity-100 group-focus-within:opacity-100",
                    )}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 flex-1 px-2 text-xs"
                      disabled={busy || p.isCover}
                      onClick={() => void setCover(p.id)}
                    >
                      <Star className="size-3.5" />
                      Нүүр
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={busy}
                      aria-label="Устгах"
                      onClick={() => void remove(p.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          JPG, PNG, WEBP, AVIF — нэг бүр 8MB хүртэл. Шинэ зураг модерацийн дараа нийтэд харагдана.
        </p>
      </CardContent>
    </Card>
  );
}
