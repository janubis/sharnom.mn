import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin,
  Phone,
  Globe,
  Clock,
  Facebook,
  Instagram,
  Mail,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/utils";
import {
  APP_NAME,
  DAYS_MN,
  DISTRICT_BY_SLUG,
  MAP_MAX_PINS,
} from "@/lib/constants";
import {
  getBusinessBySlug,
  getSimilarBusinesses,
  incrementViewCount,
} from "@/db/queries/businesses";
import { listReviews } from "@/db/queries/reviews";
import { isSaved } from "@/db/queries/saved";
import { getCurrentUser } from "@/lib/auth";
import { trackAsync } from "@/lib/analytics/track";
import {
  localBusinessJsonLd,
  breadcrumbJsonLd,
  jsonLdScript,
} from "@/lib/seo/jsonld";

import { RatingStars } from "@/components/business/rating-stars";
import { VerifiedBadge } from "@/components/business/verified-badge";
import { PriceLevel } from "@/components/business/price-level";
import { OpenStatus } from "@/components/business/open-status";
import { CategoryIcon } from "@/components/business/category-icon";
import { BusinessCard } from "@/components/business/business-card";
import { PhotoGallery } from "@/components/common/photo-gallery";
import { StarDistribution } from "@/components/common/star-distribution";
import { SectionHeading } from "@/components/common/section-heading";
import { PatternRule } from "@/components/common/pattern-rule";
import { Separator } from "@/components/ui/separator";

import { ActionBar } from "./_components/action-bar";
import { WriteReviewButton } from "./_components/action-bar";
import { FooterActions } from "./_components/footer-actions";
import { SuggestEditDialog } from "./_components/suggest-edit-dialog";
import { ReviewsSection, type ReviewView } from "./_components/reviews-section";
import { BusinessMap } from "./_components/business-map";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function districtName(slug: string | null): string | null {
  if (!slug) return null;
  return DISTRICT_BY_SLUG[slug]?.nameMn ?? slug;
}

/* ───────────────────────────── Metadata ──────────────────────────────────── */

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  if (!data) {
    return { title: "Олдсонгүй", robots: { index: false, follow: false } };
  }

  const { business, category, location, photos } = data;
  const district = districtName(location?.district ?? null);
  const descParts = [
    business.description?.trim(),
    [category?.nameMn, district].filter(Boolean).join(" · "),
    business.reviewCount > 0
      ? `${business.ratingAvg.toFixed(1)} ★ (${business.reviewCount} сэтгэгдэл)`
      : null,
  ].filter(Boolean);
  const description =
    descParts.join(" — ").slice(0, 300) ||
    `${business.name} — Mongol Local дээрх бизнесийн мэдээлэл, сэтгэгдэл, байршил.`;

  const images = photos.slice(0, 4).map((p) => p.imageUrl);

  return {
    title: `${business.name} | ${APP_NAME}`,
    description,
    alternates: { canonical: `/business/${business.slug}` },
    openGraph: {
      type: "website",
      title: `${business.name} | ${APP_NAME}`,
      description,
      url: `/business/${business.slug}`,
      images: images.length ? images : undefined,
    },
    robots:
      business.status === "ACTIVE"
        ? { index: true, follow: true }
        : { index: false, follow: true },
  };
}

/* ───────────────────────────── Hours table ───────────────────────────────── */

function fmtTime(t: string | null): string {
  if (!t) return "";
  return t.slice(0, 5);
}

function HoursTable({
  hours,
}: {
  hours: { dayOfWeek: number; openTime: string | null; closeTime: string | null; isClosed: boolean }[];
}) {
  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
  const today = new Date().getDay();
  // Render Monday..Sunday for a natural Mongolian week.
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <dl className="overflow-hidden rounded-xl border border-border">
      {order.map((d, i) => {
        const entry = byDay.get(d);
        const isToday = d === today;
        const label =
          entry && !entry.isClosed && entry.openTime && entry.closeTime
            ? `${fmtTime(entry.openTime)} – ${fmtTime(entry.closeTime)}`
            : "Хаалттай";
        return (
          <div
            key={d}
            className={cn(
              "flex items-center justify-between px-4 py-2.5 text-sm",
              i % 2 === 1 && "bg-muted/40",
              isToday && "bg-primary/5",
            )}
          >
            <dt
              className={cn(
                "text-muted-foreground",
                isToday && "font-semibold text-foreground",
              )}
            >
              {DAYS_MN[d]}
              {isToday && (
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Өнөөдөр
                </span>
              )}
            </dt>
            <dd
              className={cn(
                "tabular-nums",
                entry && !entry.isClosed
                  ? "text-foreground"
                  : "text-muted-foreground",
                isToday && "font-semibold",
              )}
            >
              {label}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/* ───────────────────────── Review serialization ──────────────────────────── */

type RawReview = Awaited<ReturnType<typeof listReviews>>["items"][number];

function toReviewView(r: RawReview): ReviewView {
  return {
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    visitDate: r.visitDate ? r.visitDate.toISOString() : null,
    usefulCount: r.usefulCount,
    funnyCount: r.funnyCount,
    coolCount: r.coolCount,
    ownerResponse: r.ownerResponse,
    ownerResponseAt: r.ownerResponseAt ? r.ownerResponseAt.toISOString() : null,
    user: { id: r.user.id, name: r.user.name, image: r.user.image },
    photos: r.photos.map((p) => ({ id: p.id, imageUrl: p.imageUrl })),
  };
}

/* ───────────────────────────────── Page ──────────────────────────────────── */

export default async function BusinessDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getBusinessBySlug(slug);
  if (!data) notFound();

  const { business, location, contact, hours, photos, category, parentCategory } =
    data;

  // Fire-and-forget: view count + analytics. Never blocks the render.
  void incrementViewCount(business.id).catch(() => {});
  trackAsync({ event: "business_viewed", businessId: business.id });

  const user = await getCurrentUser();
  const [{ items: rawReviews, total: reviewTotal }, similar, saved] =
    await Promise.all([
      listReviews(business.id, { sort: "newest", page: 1 }),
      getSimilarBusinesses(
        business.id,
        business.primaryCategoryId,
        location?.latitude ?? null,
        location?.longitude ?? null,
        6,
      ),
      user ? isSaved(user.id, business.id) : Promise.resolve(false),
    ]);

  const reviewViews = rawReviews.map(toReviewView);

  // Star distribution from the published review set (first page is enough for
  // the visible breakdown; the bars are proportional and exact counts come
  // from the aggregate total + rating average).
  const starCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of rawReviews) starCounts[r.rating] = (starCounts[r.rating] ?? 0) + 1;

  const district = districtName(location?.district ?? null);
  const hasGeo = location?.latitude != null && location?.longitude != null;

  const galleryPhotos = photos.map((p) => ({
    url: p.imageUrl,
    caption: p.caption,
  }));

  const claimable = business.verificationStatus !== "VERIFIED" && !business.ownerUserId;

  // SEO structured data.
  const ld = localBusinessJsonLd({
    name: business.name,
    slug: business.slug,
    description: business.description,
    categoryName: category?.nameMn,
    addressText: location?.addressText,
    district: district,
    city: location?.city,
    lat: location?.latitude,
    lng: location?.longitude,
    phone: contact?.phone,
    website: contact?.website,
    ratingAvg: business.ratingAvg,
    reviewCount: business.reviewCount,
    priceLevel: business.priceLevel,
    photos: photos.slice(0, 6).map((p) => p.imageUrl),
    hours: hours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openTime: h.openTime,
      closeTime: h.closeTime,
      isClosed: h.isClosed,
    })),
  });

  const crumbs = breadcrumbJsonLd(
    [
      { name: "Нүүр", url: "/" },
      parentCategory
        ? { name: parentCategory.nameMn, url: `/category/${parentCategory.slug}` }
        : null,
      category ? { name: category.nameMn, url: `/category/${category.slug}` } : null,
      { name: business.name, url: `/business/${business.slug}` },
    ].filter(Boolean) as { name: string; url: string }[],
  );

  const hoursForStatus = hours.map((h) => ({
    dayOfWeek: h.dayOfWeek,
    openTime: h.openTime,
    closeTime: h.closeTime,
    isClosed: h.isClosed,
  }));

  return (
    <article className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(ld) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(crumbs) }}
      />

      {/* Breadcrumb */}
      <nav
        aria-label="Замчлал"
        className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/" className="transition-colors hover:text-foreground">
          Нүүр
        </Link>
        {category && (
          <>
            <span aria-hidden>/</span>
            <Link
              href={`/category/${category.slug}`}
              className="transition-colors hover:text-foreground"
            >
              {category.nameMn}
            </Link>
          </>
        )}
        <span aria-hidden>/</span>
        <span className="truncate font-medium text-foreground">{business.name}</span>
      </nav>

      {/* Gallery hero */}
      <PhotoGallery photos={galleryPhotos} className="aspect-[16/9] sm:aspect-[21/9]" />

      {/* Header block */}
      <header className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {business.name}
            </h1>
            {business.verificationStatus === "VERIFIED" && <VerifiedBadge />}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <RatingStars rating={business.ratingAvg} size="md" showValue />
            <span className="text-sm text-muted-foreground">
              {business.reviewCount > 0
                ? `${formatCount(business.reviewCount)} сэтгэгдэл`
                : "Сэтгэгдэл алга"}
            </span>
            {category && (
              <>
                <span aria-hidden className="text-muted-foreground">·</span>
                <Link
                  href={`/category/${category.slug}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  <CategoryIcon
                    name={category.icon}
                    size="sm"
                    tone="muted"
                    className="size-5 rounded-md [&_svg]:size-3"
                  />
                  {category.nameMn}
                </Link>
              </>
            )}
            {business.priceLevel ? (
              <>
                <span aria-hidden className="text-muted-foreground">·</span>
                <PriceLevel priceLevel={business.priceLevel} showRange />
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
            {hours.length > 0 && (
              <OpenStatus hours={hoursForStatus} />
            )}
            {(district || location?.addressText) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 shrink-0" aria-hidden />
                <span>
                  {[district, location?.addressText].filter(Boolean).join(" · ")}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Action bar */}
        <ActionBar
          businessId={business.id}
          businessName={business.name}
          phone={contact?.phone ?? null}
          website={contact?.website ?? null}
          lat={location?.latitude ?? null}
          lng={location?.longitude ?? null}
          saved={saved}
        />
      </header>

      <PatternRule spacing="md" />

      {/* Body: main column + info sidebar */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          {/* About */}
          {business.description && (
            <section aria-labelledby="about-heading">
              <h2
                id="about-heading"
                className="mb-3 font-display text-xl font-semibold tracking-tight text-foreground"
              >
                Тухай
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90 sm:text-base">
                {business.description}
              </p>
            </section>
          )}

          {/* Reviews */}
          <section aria-labelledby="reviews-heading">
            <SectionHeading
              as="h2"
              title="Сэтгэгдлүүд"
              action={
                <WriteReviewButton
                  businessId={business.id}
                  businessName={business.name}
                  size="sm"
                />
              }
            />

            {reviewTotal > 0 && (
              <div className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-card">
                <StarDistribution
                  counts={starCounts}
                  average={business.ratingAvg}
                  total={business.reviewCount}
                />
              </div>
            )}

            <div className="mt-6">
              <ReviewsSection
                businessId={business.id}
                initialReviews={reviewViews}
                total={reviewTotal}
              />
            </div>
          </section>
        </div>

        {/* Info sidebar */}
        <aside className="flex flex-col gap-6 lg:col-span-1">
          <section
            aria-labelledby="info-heading"
            className="rounded-2xl border border-border bg-card p-5 shadow-card"
          >
            <h2
              id="info-heading"
              className="mb-4 font-display text-lg font-semibold tracking-tight text-foreground"
            >
              Мэдээлэл
            </h2>

            <ul className="flex flex-col gap-3 text-sm">
              {(district || location?.addressText) && (
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="text-foreground">
                    {[district, location?.addressText, location?.khoroo]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </li>
              )}
              {contact?.phone && (
                <li className="flex items-center gap-3">
                  <Phone className="size-4 shrink-0 text-muted-foreground" />
                  <a
                    href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                    className="text-primary transition-colors hover:text-primary/80"
                  >
                    {contact.phone}
                  </a>
                </li>
              )}
              {contact?.email && (
                <li className="flex items-center gap-3">
                  <Mail className="size-4 shrink-0 text-muted-foreground" />
                  <a
                    href={`mailto:${contact.email}`}
                    className="break-all text-primary transition-colors hover:text-primary/80"
                  >
                    {contact.email}
                  </a>
                </li>
              )}
              {contact?.website && (
                <li className="flex items-center gap-3">
                  <Globe className="size-4 shrink-0 text-muted-foreground" />
                  <a
                    href={
                      contact.website.startsWith("http")
                        ? contact.website
                        : `https://${contact.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="break-all text-primary transition-colors hover:text-primary/80"
                  >
                    {contact.website.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              )}
              {(contact?.facebookUrl || contact?.instagramUrl) && (
                <li className="flex items-center gap-3 pt-1">
                  {contact.facebookUrl && (
                    <a
                      href={contact.facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      aria-label="Facebook"
                      className="inline-flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Facebook className="size-4" />
                    </a>
                  )}
                  {contact.instagramUrl && (
                    <a
                      href={contact.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      aria-label="Instagram"
                      className="inline-flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Instagram className="size-4" />
                    </a>
                  )}
                </li>
              )}
            </ul>

            {/* Map */}
            {hasGeo && (
              <div id="map" className="mt-5">
                <BusinessMap
                  pin={{
                    id: business.id,
                    slug: business.slug,
                    name: business.name,
                    lng: location!.longitude as number,
                    lat: location!.latitude as number,
                    rating: business.ratingAvg,
                    reviewCount: business.reviewCount,
                    categoryIcon: category?.icon ?? undefined,
                    verified: business.verificationStatus === "VERIFIED",
                    priceLevel: business.priceLevel,
                  }}
                />
              </div>
            )}
          </section>

          {/* Hours */}
          {hours.length > 0 && (
            <section
              aria-labelledby="hours-heading"
              className="rounded-2xl border border-border bg-card p-5 shadow-card"
            >
              <h2
                id="hours-heading"
                className="mb-4 inline-flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-foreground"
              >
                <Clock className="size-4 text-muted-foreground" />
                Цагийн хуваарь
              </h2>
              <HoursTable hours={hoursForStatus} />
            </section>
          )}
        </aside>
      </div>

      {/* Similar nearby */}
      {similar.length > 0 && (
        <>
          <PatternRule spacing="lg" />
          <section aria-labelledby="similar-heading">
            <SectionHeading as="h2" title="Ойролцоох төстэй газрууд" />
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {similar.slice(0, MAP_MAX_PINS).map((item) => (
                <BusinessCard key={item.id} business={item} showSave={false} />
              ))}
            </div>
          </section>
        </>
      )}

      {/* Footer actions */}
      <Separator className="my-8" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SuggestEditDialog
          businessId={business.id}
          initial={{
            name: business.name,
            phone: contact?.phone ?? null,
            website: contact?.website ?? null,
            addressText: location?.addressText ?? null,
            district: location?.district ?? null,
            description: business.description ?? null,
          }}
        />
        <FooterActions
          businessId={business.id}
          businessSlug={business.slug}
          claimable={claimable}
        />
      </div>
    </article>
  );
}
