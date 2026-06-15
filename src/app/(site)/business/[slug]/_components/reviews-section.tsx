"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, MessageSquareText, Store } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RatingStars } from "@/components/business/rating-stars";
import { useToast } from "@/hooks/use-toast";
import { PAGE_SIZE } from "@/lib/constants";
import { ReviewActions } from "./review-actions";

/** Serializable review shape passed from the server page and the API. */
export type ReviewView = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
  visitDate: string | null;
  usefulCount: number;
  funnyCount: number;
  coolCount: number;
  ownerResponse: string | null;
  ownerResponseAt: string | null;
  user: { id: string; name: string | null; image: string | null };
  photos: { id: string; imageUrl: string }[];
};

type ReviewSort = "newest" | "highest" | "lowest" | "useful";

const SORT_LABELS: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "Шинэ нь эхэндээ" },
  { value: "highest", label: "Өндөр үнэлгээтэй" },
  { value: "lowest", label: "Бага үнэлгээтэй" },
  { value: "useful", label: "Хамгийн хэрэгтэй" },
];

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()} оны ${d.getMonth() + 1} сарын ${d.getDate()}`;
}

function ReviewCard({ review }: { review: ReviewView }) {
  return (
    <article className="flex flex-col gap-3 py-6">
      <div className="flex items-start gap-3">
        <Avatar className="size-11">
          {review.user.image && (
            <AvatarImage src={review.user.image} alt={review.user.name ?? ""} />
          )}
          <AvatarFallback>{initials(review.user.name)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="font-semibold text-foreground">
              {review.user.name ?? "Хэрэглэгч"}
            </span>
            <time className="text-sm text-muted-foreground">
              {formatDate(review.createdAt)}
            </time>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <RatingStars rating={review.rating} size="sm" />
            {review.visitDate && (
              <span className="text-xs text-muted-foreground">
                Зочилсон: {formatDate(review.visitDate)}
              </span>
            )}
          </div>
        </div>
      </div>

      {review.title && (
        <h4 className="font-display text-base font-semibold text-foreground">
          {review.title}
        </h4>
      )}

      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
        {review.body}
      </p>

      {review.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {review.photos.map((p) => (
            <div
              key={p.id}
              className="relative size-24 overflow-hidden rounded-xl border border-border bg-muted"
            >
              <Image
                src={p.imageUrl}
                alt=""
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

      <ReviewActions
        reviewId={review.id}
        initialCounts={{
          USEFUL: review.usefulCount,
          FUNNY: review.funnyCount,
          COOL: review.coolCount,
        }}
      />

      {review.ownerResponse && (
        <div className="mt-1 rounded-xl border border-border bg-muted/50 p-4">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Store className="size-3.5" />
            </span>
            Эзэмшигчийн хариу
            {review.ownerResponseAt && (
              <span className="font-normal text-muted-foreground">
                · {formatDate(review.ownerResponseAt)}
              </span>
            )}
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {review.ownerResponse}
          </p>
        </div>
      )}
    </article>
  );
}

export type ReviewsSectionProps = {
  businessId: string;
  initialReviews: ReviewView[];
  total: number;
  pageSize?: number;
  className?: string;
};

/**
 * Renders the server-rendered first page of reviews and lazily loads more /
 * re-sorts via GET /api/reviews. Sorting resets the list and refetches page 1.
 */
export function ReviewsSection({
  businessId,
  initialReviews,
  total,
  pageSize = PAGE_SIZE,
  className,
}: ReviewsSectionProps) {
  const { toast } = useToast();
  const [reviews, setReviews] = React.useState<ReviewView[]>(initialReviews);
  const [sort, setSort] = React.useState<ReviewSort>("newest");
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(initialReviews.length < total);

  const fetchPage = React.useCallback(
    async (nextSort: ReviewSort, nextPage: number, replace: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          businessId,
          sort: nextSort,
          page: String(nextPage),
          pageSize: String(pageSize),
        });
        const res = await fetch(`/api/reviews?${params.toString()}`);
        if (!res.ok) throw new Error("load_failed");
        const json = (await res.json()) as {
          ok: boolean;
          data?: { items: ReviewView[]; total: number; hasMore: boolean };
        };
        if (!json.ok || !json.data) throw new Error("load_failed");

        setReviews((prev) =>
          replace ? json.data!.items : [...prev, ...json.data!.items],
        );
        setHasMore(json.data.hasMore);
        setPage(nextPage);
      } catch {
        toast({
          variant: "destructive",
          title: "Сэтгэгдэл ачаалж чадсангүй",
          description: "Дахин оролдоно уу.",
        });
      } finally {
        setLoading(false);
      }
    },
    [businessId, pageSize, toast],
  );

  function onSortChange(value: string) {
    const next = value as ReviewSort;
    setSort(next);
    void fetchPage(next, 1, true);
  }

  function loadMore() {
    void fetchPage(sort, page + 1, false);
  }

  if (total === 0) {
    return (
      <div
        className={cn(
          "felt-surface flex flex-col items-center justify-center rounded-2xl border border-border px-6 py-12 text-center",
          className,
        )}
      >
        <span className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MessageSquareText className="size-6" />
        </span>
        <p className="font-display text-lg font-semibold text-foreground">
          Сэтгэгдэл алга байна
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Энэ газрын анхны сэтгэгдлийг та бичээрэй.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          Нийт {total} сэтгэгдэл
        </span>
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="w-48" aria-label="Эрэмбэлэх">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_LABELS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="divide-y divide-border">
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Илүүг харах
          </Button>
        </div>
      )}
    </div>
  );
}
