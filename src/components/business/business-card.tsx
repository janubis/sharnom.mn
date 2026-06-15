import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCount, formatDistance } from "@/lib/utils";
import { DISTRICT_BY_SLUG } from "@/lib/constants";
import type { SearchItem } from "@/lib/search/types";
import { Card } from "@/components/ui/card";
import { RatingStars } from "@/components/business/rating-stars";
import { PriceLevel } from "@/components/business/price-level";
import { VerifiedBadge } from "@/components/business/verified-badge";
import { CategoryIcon, lucideByName } from "@/components/business/category-icon";
import { SaveButton } from "@/components/business/save-button";

export type BusinessCardProps = {
  business: SearchItem;
  /** "grid" = vertical card; "row" = horizontal (split list view). */
  layout?: "grid" | "row";
  /** Whether the current user has saved this business (server-known). */
  saved?: boolean;
  /** Show the save heart overlay. */
  showSave?: boolean;
  /** Priority-load the cover image (above-the-fold cards). */
  priority?: boolean;
  className?: string;
};

function districtName(slug: string | null): string | null {
  if (!slug) return null;
  return DISTRICT_BY_SLUG[slug]?.nameMn ?? slug;
}

/** Gradient + category glyph fallback when no cover photo exists. */
function CoverFallback({
  icon,
  className,
}: {
  icon: string | null | undefined;
  className?: string;
}) {
  const Glyph = lucideByName(icon);
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-secondary/15 to-muted",
        className,
      )}
    >
      <Glyph className="size-10 text-primary/40" aria-hidden />
    </div>
  );
}

/**
 * The core discovery card. Renders a SearchItem in either a vertical "grid"
 * layout or a horizontal "row" layout for split list/map views. The whole
 * card is a link to /business/[slug]; the save heart stops propagation.
 */
export function BusinessCard({
  business,
  layout = "grid",
  saved = false,
  showSave = true,
  priority = false,
  className,
}: BusinessCardProps) {
  const href = `/business/${business.slug}`;
  const district = districtName(business.district);
  const hasCover = Boolean(business.coverPhotoUrl);

  const meta = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      {business.category && (
        <span className="inline-flex items-center gap-1">
          <CategoryIcon
            name={business.category.icon}
            size="sm"
            tone="muted"
            className="size-5 rounded-md [&_svg]:size-3"
          />
          {business.category.nameMn}
        </span>
      )}
      {business.priceLevel ? (
        <>
          <span aria-hidden>·</span>
          <PriceLevel priceLevel={business.priceLevel} />
        </>
      ) : null}
    </div>
  );

  const location = (district || business.addressText) && (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <MapPin className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">
        {district}
        {district && business.addressText ? " · " : ""}
        {business.addressText}
      </span>
      {business.distanceMeters != null && (
        <span className="ml-auto whitespace-nowrap font-medium text-foreground">
          {formatDistance(business.distanceMeters)}
        </span>
      )}
    </div>
  );

  const rating = (
    <div className="flex items-center gap-2">
      <RatingStars rating={business.ratingAvg} size="sm" showValue />
      <span className="text-sm text-muted-foreground">
        {business.reviewCount > 0
          ? `${formatCount(business.reviewCount)} сэтгэгдэл`
          : "Сэтгэгдэл алга"}
      </span>
    </div>
  );

  if (layout === "row") {
    return (
      <Card
        className={cn(
          "group relative flex gap-4 overflow-hidden p-3 transition-shadow hover:shadow-card-hover sm:p-4",
          className,
        )}
      >
        <Link
          href={href}
          aria-label={business.name}
          className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-28">
          {hasCover ? (
            <Image
              src={business.coverPhotoUrl as string}
              alt={business.name}
              fill
              sizes="112px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <CoverFallback icon={business.category?.icon} />
          )}
        </div>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-1.5 pointer-events-none">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 truncate font-display text-base font-semibold leading-tight text-foreground">
              {business.name}
            </h3>
            {business.verified && <VerifiedBadge iconOnly />}
          </div>
          {rating}
          {meta}
          {location}
        </div>

        {showSave && (
          <div className="relative z-10 self-start">
            <SaveButton
              businessId={business.id}
              initialSaved={saved}
              size="sm"
            />
          </div>
        )}
      </Card>
    );
  }

  // Grid (default)
  return (
    <Card
      className={cn(
        "group relative flex flex-col overflow-hidden transition-shadow hover:shadow-card-hover",
        className,
      )}
    >
      <Link
        href={href}
        aria-label={business.name}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {hasCover ? (
          <Image
            src={business.coverPhotoUrl as string}
            alt={business.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={priority}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <CoverFallback icon={business.category?.icon} />
        )}

        {business.verified && (
          <div className="absolute left-3 top-3 z-10">
            <VerifiedBadge />
          </div>
        )}
        {showSave && (
          <div className="absolute right-3 top-3 z-10">
            <SaveButton businessId={business.id} initialSaved={saved} />
          </div>
        )}
        {business.distanceMeters != null && (
          <div className="absolute bottom-3 left-3 z-10 rounded-full bg-background/85 px-2 py-0.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
            {formatDistance(business.distanceMeters)}
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-1 flex-col gap-1.5 p-4 pointer-events-none">
        <h3 className="truncate font-display text-base font-semibold leading-tight text-foreground">
          {business.name}
        </h3>
        {rating}
        {meta}
        {location}
      </div>
    </Card>
  );
}

/** Matching skeleton for loading states. */
export function BusinessCardSkeleton({
  layout = "grid",
}: {
  layout?: "grid" | "row";
}) {
  if (layout === "row") {
    return (
      <div className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="shimmer h-24 w-24 shrink-0 rounded-xl bg-muted sm:h-28 sm:w-28" />
        <div className="flex flex-1 flex-col gap-2 py-1">
          <div className="shimmer h-4 w-2/3 rounded bg-muted" />
          <div className="shimmer h-3 w-1/3 rounded bg-muted" />
          <div className="shimmer h-3 w-1/2 rounded bg-muted" />
          <div className="shimmer mt-auto h-3 w-2/5 rounded bg-muted" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="shimmer aspect-[4/3] w-full bg-muted" />
      <div className="flex flex-col gap-2 p-4">
        <div className="shimmer h-4 w-3/4 rounded bg-muted" />
        <div className="shimmer h-3 w-1/2 rounded bg-muted" />
        <div className="shimmer h-3 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}
