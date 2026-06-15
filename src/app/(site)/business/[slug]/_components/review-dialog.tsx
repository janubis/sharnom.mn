"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { ImagePlus, Loader2, X, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StarRatingInput } from "@/components/business/rating-stars";
import { useToast } from "@/hooks/use-toast";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/upload";

const MAX_PHOTOS = 8;
const MIN_BODY = 10;
const MAX_BODY = 5000;

type LocalPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  key?: string;
  uploading: boolean;
  error?: boolean;
};

export type ReviewDialogProps = {
  businessId: string;
  businessName: string;
  /** Controlled open state — the parent (action bar) owns the trigger. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Review composer: star rating, optional title, body, visit date and up to
 * eight photos. Photos are uploaded via the presign flow (POST /api/photos →
 * PUT to S3) before the review is submitted to POST /api/reviews. On success
 * the page is refreshed so the new review appears.
 */
export function ReviewDialog({
  businessId,
  businessName,
  open,
  onOpenChange,
}: ReviewDialogProps) {
  const router = useRouter();
  const { status } = useSession();
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [rating, setRating] = React.useState(0);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [visitDate, setVisitDate] = React.useState("");
  const [photos, setPhotos] = React.useState<LocalPhoto[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  // Redirect anonymous users who somehow open the dialog.
  React.useEffect(() => {
    if (open && status === "unauthenticated") {
      onOpenChange(false);
      router.push(
        `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      );
    }
  }, [open, status, onOpenChange, router]);

  // Revoke object URLs on unmount.
  React.useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setRating(0);
    setTitle("");
    setBody("");
    setVisitDate("");
    setPhotos([]);
    setTouched(false);
  }

  async function uploadOne(local: LocalPhoto) {
    try {
      const presignRes = await fetch("/api/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: "review",
          targetId: businessId,
          fileName: local.file.name,
          contentType: local.file.type,
          size: local.file.size,
        }),
      });
      if (presignRes.status === 401) {
        router.push(
          `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }
      if (!presignRes.ok) throw new Error("presign_failed");
      const json = (await presignRes.json()) as {
        ok: boolean;
        data?: { url: string; key: string; publicUrl: string };
      };
      if (!json.ok || !json.data) throw new Error("presign_failed");

      const putRes = await fetch(json.data.url, {
        method: "PUT",
        headers: { "content-type": local.file.type },
        body: local.file,
      });
      if (!putRes.ok) throw new Error("upload_failed");

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === local.id
            ? { ...p, key: json.data!.key, uploading: false, error: false }
            : p,
        ),
      );
    } catch {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === local.id ? { ...p, uploading: false, error: true } : p,
        ),
      );
      toast({
        variant: "destructive",
        title: "Зураг байршуулж чадсангүй",
        description: local.file.name,
      });
    }
  }

  function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast({
        variant: "destructive",
        title: `Дээд тал нь ${MAX_PHOTOS} зураг`,
      });
      return;
    }
    const incoming = Array.from(files).slice(0, room);
    const accepted: LocalPhoto[] = [];
    for (const file of incoming) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type as never)) {
        toast({
          variant: "destructive",
          title: "Дэмжигдэхгүй формат",
          description: "JPG, PNG, WEBP, AVIF зураг оруулна уу.",
        });
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast({
          variant: "destructive",
          title: "Зураг хэт том байна",
          description: "8MB-аас бага байх ёстой.",
        });
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        uploading: true,
      });
    }
    if (accepted.length) {
      setPhotos((prev) => [...prev, ...accepted]);
      accepted.forEach((p) => void uploadOne(p));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  const anyUploading = photos.some((p) => p.uploading);
  const bodyValid = body.trim().length >= MIN_BODY;
  const ratingValid = rating >= 1;
  const canSubmit = ratingValid && bodyValid && !anyUploading && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!ratingValid || !bodyValid) return;
    if (anyUploading) {
      toast({ title: "Зураг байршиж дуусахыг хүлээнэ үү" });
      return;
    }

    setSubmitting(true);
    try {
      const photoKeys = photos
        .filter((p) => p.key && !p.error)
        .map((p) => p.key as string);

      const payload: Record<string, unknown> = {
        businessId,
        rating,
        body: body.trim(),
      };
      if (title.trim()) payload.title = title.trim();
      if (visitDate) payload.visitDate = visitDate;
      if (photoKeys.length) payload.photoKeys = photoKeys;

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        router.push(
          `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }
      if (res.status === 409) {
        toast({
          variant: "destructive",
          title: "Та аль хэдийн сэтгэгдэл үлдээсэн",
          description: "Энэ газарт зөвхөн нэг сэтгэгдэл бичих боломжтой.",
        });
        return;
      }
      if (!res.ok) throw new Error("review_failed");

      toast({ title: "Сэтгэгдэл илгээсэнд баярлалаа!" });
      reset();
      onOpenChange(false);
      router.refresh();
    } catch {
      toast({
        variant: "destructive",
        title: "Алдаа гарлаа",
        description: "Сэтгэгдэл илгээж чадсангүй. Дахин оролдоно уу.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !submitting) onOpenChange(false);
        else if (v) onOpenChange(true);
      }}
    >
      <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{businessName}</DialogTitle>
          <DialogDescription>Туршлагаа бусадтай хуваалцаарай</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Rating */}
          <div className="flex flex-col gap-2">
            <Label>Таны үнэлгээ</Label>
            <StarRatingInput value={rating} onChange={setRating} />
            {touched && !ratingValid && (
              <p className="text-sm text-destructive">Үнэлгээ өгнө үү.</p>
            )}
          </div>

          {/* Title */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-title">Гарчиг</Label>
            <Input
              id="review-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Сэтгэгдлээ товчоор..."
              maxLength={200}
            />
          </div>

          {/* Body */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-body">Дэлгэрэнгүй</Label>
            <Textarea
              id="review-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Энэ газрын талаар туршлагаа хуваалцаарай"
              maxLength={MAX_BODY}
              className="min-h-32"
            />
            <div className="flex items-center justify-between text-xs">
              {touched && !bodyValid ? (
                <span className="text-destructive">
                  Дор хаяж {MIN_BODY} тэмдэгт бичнэ үү.
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Дор хаяж {MIN_BODY} тэмдэгт
                </span>
              )}
              <span className="text-muted-foreground tabular-nums">
                {body.trim().length}/{MAX_BODY}
              </span>
            </div>
          </div>

          {/* Visit date */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-visit">Зочилсон огноо</Label>
            <Input
              id="review-visit"
              type="date"
              value={visitDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full sm:w-56"
            />
          </div>

          {/* Photos */}
          <div className="flex flex-col gap-2">
            <Label>Зураг нэмэх</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="relative size-20 overflow-hidden rounded-xl border border-border bg-muted"
                >
                  <Image
                    src={p.previewUrl}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                  />
                  {p.uploading && (
                    <span className="absolute inset-0 flex items-center justify-center bg-foreground/40">
                      <Loader2 className="size-5 animate-spin text-background" />
                    </span>
                  )}
                  {p.error && (
                    <span className="absolute inset-0 flex items-center justify-center bg-destructive/70 text-[10px] font-medium text-destructive-foreground">
                      Алдаа
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(p.id)}
                    aria-label="Зураг хасах"
                    className="absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-foreground/70 text-background transition hover:bg-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}

              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ImagePlus className="size-5" />
                  <span className="text-[10px]">Нэмэх</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </div>

          {/* Rules notice */}
          <div className="flex gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Бодит туршлага дээрээ үндэслэн бичнэ үү. Хуурамч, спам,
              доромжилсон сэтгэгдэл устгагдана.
            </span>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Цуцлах
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting && <Loader2 className="animate-spin" />}
              Нийтлэх
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
