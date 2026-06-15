import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPinned, Store } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/common/section-heading";
import { PatternRule } from "@/components/common/pattern-rule";
import { CategoryIcon } from "@/components/business/category-icon";
import { BusinessCard } from "@/components/business/business-card";
import { EmptyState } from "@/components/common/empty-state";
import { MapPreview } from "@/components/map/map-preview";
import { Button } from "@/components/ui/button";

import {
  getDistrictBySlug,
  topBusinessesByDistrict,
} from "@/db/queries/districts";
import { savedIdsForUser } from "@/db/queries/saved";
import { getCurrentUser } from "@/lib/auth";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/jsonld";
import { UB_DISTRICTS, APP_NAME } from "@/lib/constants";
import type { MapPin } from "@/lib/maps/provider";
import type { SearchItem } from "@/lib/search/types";

// SEO landing pages — pre-render and revalidate hourly.
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return UB_DISTRICTS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const district = await getDistrictBySlug(slug);
  if (!district) return { title: "Дүүрэг олдсонгүй" };

  const title = `${district.nameMn} дүүргийн шилдэг газрууд`;
  return {
    title,
    description: `${district.nameMn} дүүргийн шилдэг ресторан, кафе, үйлчилгээ, дэлгүүрүүд — сэтгэгдэл, үнэлгээ, газрын зурагтайгаар. ${APP_NAME}.`,
    alternates: { canonical: `/district/${slug}` },
    openGraph: { title: `${title} | ${APP_NAME}`, type: "website" },
  };
}

function pinsFrom(items: SearchItem[]): MapPin[] {
  const pins: MapPin[] = [];
  for (const it of items) {
    if (it.lat == null || it.lng == null) continue;
    pins.push({
      id: it.id,
      slug: it.slug,
      name: it.name,
      lat: it.lat,
      lng: it.lng,
      rating: it.ratingAvg,
      reviewCount: it.reviewCount,
      categoryIcon: it.category?.icon ?? undefined,
      verified: it.verified,
      priceLevel: it.priceLevel,
    });
  }
  return pins;
}

export default async function DistrictPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const district = await getDistrictBySlug(slug);
  if (!district) notFound();

  const [user, groups] = await Promise.all([
    getCurrentUser(),
    topBusinessesByDistrict(slug, 4),
  ]);

  const allItems = groups.flatMap((g) => g.businesses);
  const savedSet = user?.id
    ? await savedIdsForUser(
        user.id,
        allItems.map((b) => b.id),
      )
    : new Set<string>();

  const pins = pinsFrom(allItems);

  const breadcrumb = breadcrumbJsonLd([
    { name: "Нүүр", url: "/" },
    { name: `${district.nameMn} дүүрэг`, url: `/district/${slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumb) }}
      />

      {/* Header */}
      <section className="felt-surface border-b border-border">
        <Container className="py-10 sm:py-12">
          <nav
            className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground"
            aria-label="Замчлал"
          >
            <Link href="/" className="hover:text-foreground">
              Нүүр
            </Link>
            <span aria-hidden>/</span>
            <span className="text-foreground">{district.nameMn} дүүрэг</span>
          </nav>

          <div className="flex items-center gap-4">
            <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPinned className="size-7" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {district.nameMn} дүүргийн шилдэг газрууд
              </h1>
              {district.businessCount > 0 && (
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  {district.businessCount} газар бүртгэлтэй
                </p>
              )}
            </div>
          </div>

          <div className="mt-5">
            <Button asChild size="sm">
              <Link href={`/search?district=${slug}`}>
                Энэ дүүргийн бүх газрыг үзэх
              </Link>
            </Button>
          </div>
        </Container>
      </section>

      <Container className="space-y-12 py-10">
        {groups.length === 0 ? (
          <EmptyState
            icon={Store}
            title="Одоогоор газар алга"
            description={`${district.nameMn} дүүрэгт бүртгэлтэй газар хараахан алга байна.`}
            action={{ label: "Бизнес нэмэх", href: "/owner/businesses/new" }}
          />
        ) : (
          <>
            {/* Map preview */}
            {pins.length > 0 && (
              <section>
                <SectionHeading
                  title="Газрын зураг"
                  subtitle={`${district.nameMn} дүүргийн газрууд`}
                  action={
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/search?district=${slug}&view=map`}>
                        Бүтэн зураг
                      </Link>
                    </Button>
                  }
                />
                <div className="mt-5">
                  <MapPreview
                    pins={pins}
                    center={{ lng: district.lng, lat: district.lat }}
                    zoom={13}
                    height={340}
                  />
                </div>
              </section>
            )}

            <PatternRule spacing="none" />

            {/* Top businesses grouped by category */}
            {groups.map((group) => (
              <section key={group.category.id}>
                <SectionHeading
                  as="h2"
                  title={
                    <span className="inline-flex items-center gap-2">
                      <CategoryIcon
                        name={group.category.icon}
                        size="sm"
                        tone="muted"
                      />
                      {group.category.nameMn}
                    </span>
                  }
                  href={`/search?district=${slug}&category=${encodeURIComponent(group.category.slug)}`}
                />
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {group.businesses.map((b) => (
                    <BusinessCard
                      key={b.id}
                      business={b}
                      saved={savedSet.has(b.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </Container>
    </>
  );
}
