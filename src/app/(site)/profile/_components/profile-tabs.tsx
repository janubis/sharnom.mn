"use client";

import * as React from "react";
import Link from "next/link";
import { MessageSquare, ImageIcon, Heart, BarChart3 } from "lucide-react";

import { formatCount } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { RatingStars } from "@/components/business/rating-stars";
import { BusinessCard } from "@/components/business/business-card";
import { EmptyState } from "@/components/common/empty-state";
import type { SearchItem } from "@/lib/search/types";

export type ProfileReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
  business: { id: string; name: string; slug: string } | null;
};

export type ProfileStats = {
  reviewCount: number;
  photoCount: number;
  savedCount: number;
  memberSince: string;
};

export type ProfileTabsProps = {
  reviews: ProfileReview[];
  saved: SearchItem[];
  savedIds: string[];
  stats: ProfileStats;
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("mn-MN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function ReviewItem({ review }: { review: ProfileReview }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {review.business ? (
          <Link
            href={`/business/${review.business.slug}`}
            className="font-display font-semibold text-foreground hover:text-primary"
          >
            {review.business.name}
          </Link>
        ) : (
          <span className="font-display font-semibold text-muted-foreground">
            Устгагдсан газар
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {formatDate(review.createdAt)}
        </span>
      </div>
      <div className="mt-1.5">
        <RatingStars rating={review.rating} size="sm" showValue />
      </div>
      {review.title && (
        <p className="mt-2 font-medium text-foreground">{review.title}</p>
      )}
      <p className="mt-1 line-clamp-4 text-sm text-muted-foreground">
        {review.body}
      </p>
    </Card>
  );
}

const TAB_CLS =
  "flex-1 gap-1.5 sm:flex-none [&>span]:hidden sm:[&>span]:inline";

export function ProfileTabs({
  reviews,
  saved,
  savedIds,
  stats,
}: ProfileTabsProps) {
  const savedSet = React.useMemo(() => new Set(savedIds), [savedIds]);

  return (
    <Tabs defaultValue="reviews" className="w-full">
      <TabsList className="flex w-full sm:inline-flex sm:w-auto">
        <TabsTrigger value="reviews" className={TAB_CLS}>
          <MessageSquare className="size-4" />
          <span>Миний сэтгэгдлүүд</span>
        </TabsTrigger>
        <TabsTrigger value="photos" className={TAB_CLS}>
          <ImageIcon className="size-4" />
          <span>Зургууд</span>
        </TabsTrigger>
        <TabsTrigger value="saved" className={TAB_CLS}>
          <Heart className="size-4" />
          <span>Хадгалсан</span>
        </TabsTrigger>
        <TabsTrigger value="stats" className={TAB_CLS}>
          <BarChart3 className="size-4" />
          <span>Статистик</span>
        </TabsTrigger>
      </TabsList>

      {/* Reviews */}
      <TabsContent value="reviews">
        {reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map((r) => (
              <ReviewItem key={r.id} review={r} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="Сэтгэгдэл алга байна"
            description="Та зочилсон газруудаа үнэлж, бусдад туслаарай."
            action={{ label: "Газар хайх", href: "/search" }}
            compact
          />
        )}
      </TabsContent>

      {/* Photos */}
      <TabsContent value="photos">
        {stats.photoCount > 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Та {formatCount(stats.photoCount)} зураг нэмсэн байна. Зургууд
            сэтгэгдэл бичсэн газруудынхаа хуудсан дээр харагдана.
          </Card>
        ) : (
          <EmptyState
            icon={ImageIcon}
            title="Зураг алга байна"
            description="Сэтгэгдэл бичихдээ зураг нэмж газрыг илүү тодорхой болгоорой."
            compact
          />
        )}
      </TabsContent>

      {/* Saved */}
      <TabsContent value="saved">
        {saved.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {saved.map((b) => (
                <BusinessCard
                  key={b.id}
                  business={b}
                  saved={savedSet.has(b.id)}
                />
              ))}
            </div>
            {stats.savedCount > saved.length && (
              <div className="mt-5 text-center">
                <Link
                  href="/saved"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Бүх хадгалсан газрыг үзэх ({stats.savedCount})
                </Link>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={Heart}
            title="Та одоогоор газар хадгалаагүй байна"
            description="Дуртай газруудаа хадгалж, дараа нь хялбар олоорой."
            action={{ label: "Газар хайх", href: "/search" }}
            compact
          />
        )}
      </TabsContent>

      {/* Stats */}
      <TabsContent value="stats">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Бичсэн сэтгэгдэл"
            value={formatCount(stats.reviewCount)}
            icon={MessageSquare}
          />
          <StatCard
            label="Нэмсэн зураг"
            value={formatCount(stats.photoCount)}
            icon={ImageIcon}
          />
          <StatCard
            label="Хадгалсан газар"
            value={formatCount(stats.savedCount)}
            icon={Heart}
          />
          <StatCard
            label="Гишүүн болсон"
            value={stats.memberSince}
            icon={BarChart3}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
