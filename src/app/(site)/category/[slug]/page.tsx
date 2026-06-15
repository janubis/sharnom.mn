import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { MapPin, Store } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/common/section-heading";
import { PatternRule } from "@/components/common/pattern-rule";
import { CategoryIcon } from "@/components/business/category-icon";
import { BusinessCard } from "@/components/business/business-card";
import { EmptyState } from "@/components/common/empty-state";
import { MapPreview } from "@/components/map/map-preview";
import { Button } from "@/components/ui/button";

import { getCategoryBySlug } from "@/db/queries/categories";
import { getTopRated } from "@/db/queries/businesses";
import { savedIdsForUser } from "@/db/queries/saved";
import { getCurrentUser } from "@/lib/auth";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/jsonld";
import {
  LEAF_CATEGORY_SLUGS,
  CATEGORY_TAXONOMY,
  UB_DISTRICTS,
  UB_CENTER,
  APP_NAME,
} from "@/lib/constants";
import type { MapPin as MapPinType } from "@/lib/maps/provider";
import type { SearchItem } from "@/lib/search/types";

// SEO landing pages — pre-render and revalidate hourly.
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  const parents = CATEGORY_TAXONOMY.map((c) => c.slug);
  return [...new Set([...parents, ...LEAF_CATEGORY_SLUGS])].map((slug) => ({
    slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryBySlug(slug);
  if (!data) return { title: "Ангилал олдсонгүй" };

  const name = data.category.nameMn;
  const title = `Улаанбаатар дахь шилдэг ${name}`;
  return {
    title,
    description: `Улаанбаатар хотын шилдэг ${name} — хэрэглэгчдийн сэтгэгдэл, үнэлгээ, газрын зураг, хаягтайгаар. ${APP_NAME} дээр харьцуулж сонгоорой.`,
    alternates: { canonical: `/category/${slug}` },
    openGraph: { title: `${title} | ${APP_NAME}`, type: "website" },
  };
}

function pinsFrom(items: SearchItem[]): MapPinType[] {
  const pins: MapPinType[] = [];
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

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getCategoryBySlug(slug);
  if (!data) notFound();

  const { category, parent, children } = data;
  const name = category.nameMn;

  const [user, businesses] = await Promise.all([
    getCurrentUser(),
    getTopRated(24, { categorySlug: slug }),
  ]);

  const savedSet = user?.id
    ? await savedIdsForUser(
        user.id,
        businesses.map((b) => b.id),
      )
    : new Set<string>();

  const pins = pinsFrom(businesses);

  const breadcrumb = breadcrumbJsonLd([
    { name: "Нүүр", url: "/" },
    ...(parent
      ? [{ name: parent.nameMn, url: `/category/${parent.slug}` }]
      : []),
    { name, url: `/category/${slug}` },
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
            {parent && (
              <>
                <Link
                  href={`/category/${parent.slug}`}
                  className="hover:text-foreground"
                >
                  {parent.nameMn}
                </Link>
                <span aria-hidden>/</span>
              </>
            )}
            <span className="text-foreground">{name}</span>
          </nav>

          <div className="flex items-center gap-4">
            <CategoryIcon name={category.icon} size="lg" />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Улаанбаатар дахь шилдэг {name}
              </h1>
              {category.businessCount > 0 && (
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  {category.businessCount} газар бүртгэлтэй
                </p>
              )}
            </div>
          </div>

          {/* Sub-categories of a parent, or sibling links */}
          {children.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {children.map((c) => (
                <Link
                  key={c.id}
                  href={`/category/${c.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <CategoryIcon
                    name={c.icon}
                    size="sm"
                    tone="muted"
                    className="size-5 rounded-md [&_svg]:size-3"
                  />
                  {c.nameMn}
                </Link>
              ))}
            </div>
          )}
        </Container>
      </section>

      <Container className="space-y-10 py-10">
        {/* District quick filter → jumps to /search scoped to this category */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Дүүргээр шүүх
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {UB_DISTRICTS.map((d) => (
              <Link
                key={d.slug}
                href={`/search?category=${encodeURIComponent(slug)}&district=${d.slug}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <MapPin className="size-3.5 opacity-70" aria-hidden />
                {d.nameMn}
              </Link>
            ))}
          </div>
        </section>

        <PatternRule spacing="none" />

        {/* Businesses */}
        <section>
          <SectionHeading
            title={`Эрэлттэй ${name}`}
            subtitle="Өндөр үнэлгээтэй газрууд эхэндээ"
            href={`/search?category=${encodeURIComponent(slug)}`}
            linkLabel="Бүгдийг хайх"
          />
          {businesses.length > 0 ? (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {businesses.map((b, i) => (
                <BusinessCard
                  key={b.id}
                  business={b}
                  saved={savedSet.has(b.id)}
                  priority={i < 3}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Store}
              title="Одоогоор газар алга"
              description={`${name} ангилалд бүртгэлтэй газар хараахан алга байна.`}
              action={{ label: "Бизнес нэмэх", href: "/owner/businesses/new" }}
              className="mt-5"
            />
          )}
        </section>

        {/* Map preview */}
        {pins.length > 0 && (
          <section>
            <SectionHeading
              title="Газрын зураг дээр"
              subtitle="Энэ ангилалд хамаарах газрууд"
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href={`/search?category=${encodeURIComponent(slug)}&view=map`}>
                    Бүтэн зураг
                  </Link>
                </Button>
              }
            />
            <div className="mt-5">
              <MapPreview
                pins={pins}
                center={{ lng: UB_CENTER.lng, lat: UB_CENTER.lat }}
                height={360}
              />
            </div>
          </section>
        )}
      </Container>
    </>
  );
}
