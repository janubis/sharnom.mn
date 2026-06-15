import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, Store } from "lucide-react";

import { auth } from "@/lib/auth";
import { listOwnerBusinesses } from "@/db/queries/owner";
import { listReviews, type ReviewListItem } from "@/db/queries/reviews";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { RatingStars } from "@/components/business/rating-stars";
import { EmptyState } from "@/components/common/empty-state";
import { OwnerPageHeader } from "../_components/page-header";
import { BusinessFilter } from "./_components/business-filter";
import { ReviewRespond } from "./_components/review-respond";

export const metadata: Metadata = {
  title: "Сэтгэгдэл",
};

type ReviewWithBusiness = ReviewListItem & {
  businessName: string;
  businessSlug: string;
};

function userInitials(name?: string | null): string {
  const base = name?.trim() || "";
  if (!base) return "?";
  const parts = base.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default async function OwnerReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string }>;
}) {
  const { business: businessFilter } = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  const owned = await listOwnerBusinesses(userId);

  // Restrict to the filtered business if it actually belongs to this owner.
  const scoped =
    businessFilter && owned.some((b) => b.id === businessFilter)
      ? owned.filter((b) => b.id === businessFilter)
      : owned;

  // Gather the most recent published reviews for each owned business.
  const perBusiness = await Promise.all(
    scoped.map(async (b) => {
      const { items } = await listReviews(b.id, {
        sort: "newest",
        page: 1,
        pageSize: 50,
        status: "PUBLISHED",
      });
      return items.map<ReviewWithBusiness>((r) => ({
        ...r,
        businessName: b.name,
        businessSlug: b.slug,
      }));
    }),
  );

  const reviews = perBusiness
    .flat()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const pending = reviews.filter((r) => !r.ownerResponse).length;

  return (
    <div>
      <OwnerPageHeader
        title="Сэтгэгдэл"
        description="Бизнесүүдийн сэтгэгдэлд хариулж, харилцаагаа бэхжүүлээрэй"
      >
        {owned.length > 1 && (
          <BusinessFilter
            businesses={owned.map((b) => ({ id: b.id, name: b.name }))}
            value={businessFilter ?? ""}
          />
        )}
      </OwnerPageHeader>

      {owned.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Та одоогоор бизнес эзэмшээгүй байна"
          description="Бизнесээ эзэмшсэнээр сэтгэгдэлд хариулах боломжтой болно."
          action={{ label: "Бизнесээ эзэмших", href: "/owner/claim" }}
        />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Сэтгэгдэл алга байна"
          description="Хэрэглэгчид сэтгэгдэл үлдээх үед энд харагдана."
        />
      ) : (
        <div className="space-y-4">
          {pending > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
              <MessageSquare className="size-4 text-primary" />
              Хариу хүлээж буй{" "}
              <span className="font-semibold text-foreground">{pending}</span>{" "}
              сэтгэгдэл байна
            </div>
          )}

          {reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-5">
                {/* Business + meta */}
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Link
                    href={`/business/${r.businessSlug}`}
                    target="_blank"
                    className="truncate text-sm font-semibold text-primary hover:underline"
                  >
                    {r.businessName}
                  </Link>
                  {!r.ownerResponse && <Badge variant="warning">Хариу хүлээж буй</Badge>}
                </div>

                {/* Reviewer */}
                <div className="flex items-start gap-3">
                  <Avatar className="size-10">
                    {r.user.image && (
                      <AvatarImage src={r.user.image} alt={r.user.name ?? ""} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {userInitials(r.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium text-foreground">
                        {r.user.name ?? "Хэрэглэгч"}
                      </span>
                      <RatingStars rating={r.rating} size="sm" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString("mn-MN")}
                      </span>
                    </div>
                    {r.title && (
                      <h4 className="mt-1.5 font-semibold text-foreground">{r.title}</h4>
                    )}
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground/90">
                      {r.body}
                    </p>

                    {r.photos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {r.photos.map((p) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={p.id}
                            src={p.imageUrl}
                            alt=""
                            className="size-16 rounded-lg border border-border object-cover"
                          />
                        ))}
                      </div>
                    )}

                    {/* Inline owner response */}
                    <ReviewRespond
                      businessId={r.businessId}
                      reviewId={r.id}
                      initialResponse={r.ownerResponse}
                      respondedAt={
                        r.ownerResponseAt
                          ? new Date(r.ownerResponseAt).toISOString()
                          : null
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
