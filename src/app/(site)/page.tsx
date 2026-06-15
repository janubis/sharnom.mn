import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Clock, MapPinned } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SearchBar } from "@/components/common/search-bar";
import { SectionHeading } from "@/components/common/section-heading";
import { DistrictChips } from "@/components/common/district-chips";
import { PatternRule } from "@/components/common/pattern-rule";
import { CategoryIcon } from "@/components/business/category-icon";
import { BusinessCard } from "@/components/business/business-card";
import { EmptyState } from "@/components/common/empty-state";

import { getPopularCategories } from "@/db/queries/categories";
import { getTopRated, getNewest } from "@/db/queries/businesses";
import { listDistricts } from "@/db/queries/districts";
import { savedIdsForUser } from "@/db/queries/saved";
import { getCurrentUser } from "@/lib/auth";
import { websiteJsonLd, jsonLdScript } from "@/lib/seo/jsonld";

// ISR — discovery feeds are fine slightly stale; revalidate hourly.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Улаанбаатарын шилдэг газрууд",
  description:
    "Улаанбаатар хот болон Монгол даяарх ресторан, кафе, үйлчилгээ, дэлгүүрүүдийг сэтгэгдэл, үнэлгээ, газрын зурагтайгаар олж нээ.",
  alternates: { canonical: "/" },
};

/** Browse-by-category tile linking to the category landing page. */
function CategoryTile({
  slug,
  name,
  icon,
  count,
}: {
  slug: string;
  name: string;
  icon: string | null;
  count: number;
}) {
  return (
    <Link
      href={`/category/${slug}`}
      className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 text-center shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-5"
    >
      <CategoryIcon
        name={icon}
        size="lg"
        className="transition-transform group-hover:scale-105"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        {count > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {count} газар
          </p>
        )}
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const [user, popularCategories, topRated, newest, districts] =
    await Promise.all([
      getCurrentUser(),
      getPopularCategories(12),
      getTopRated(8),
      getNewest(8),
      listDistricts(),
    ]);

  // Resolve which of the surfaced businesses the current user has saved.
  const allIds = [...topRated, ...newest].map((b) => b.id);
  const savedSet = user?.id
    ? await savedIdsForUser(user.id, allIds)
    : new Set<string>();

  const districtCounts = Object.fromEntries(
    districts.map((d) => [d.slug, d.businessCount]),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd()) }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="felt-surface relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-secondary/[0.06]"
          aria-hidden
        />
        <Container className="relative py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm ring-1 ring-inset ring-border">
              <Sparkles className="size-3.5 text-secondary" aria-hidden />
              Монголын газрын лавлах
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Улаанбаатарын шилдэг
              <br className="hidden sm:block" /> газруудыг олоорой
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
              Ресторан, кафе, үйлчилгээ, дэлгүүр — бодит сэтгэгдэл, үнэлгээ,
              газрын зурагтайгаар.
            </p>
          </div>

          <div className="mx-auto mt-7 max-w-2xl">
            <SearchBar variant="hero" autoFocus={false} />
          </div>

          {/* Quick district access */}
          <div className="mx-auto mt-6 max-w-3xl">
            <DistrictChips counts={districtCounts} className="justify-center" />
          </div>
        </Container>
      </section>

      <Container className="space-y-14 py-12 sm:py-16">
        {/* ── Popular categories ─────────────────────────────────────── */}
        {popularCategories.length > 0 && (
          <section>
            <SectionHeading
              title="Эрэлттэй ангилал"
              subtitle="Юу хайж байгаагаа сонгоод эхэл"
              href="/search?view=categories"
            />
            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
              {popularCategories.map((c) => (
                <CategoryTile
                  key={c.id}
                  slug={c.slug}
                  name={c.nameMn}
                  icon={c.icon}
                  count={c.businessCount}
                />
              ))}
            </div>
          </section>
        )}

        <PatternRule spacing="none" />

        {/* ── Top rated ──────────────────────────────────────────────── */}
        <section>
          <SectionHeading
            title="Өндөр үнэлгээтэй газрууд"
            subtitle="Хэрэглэгчдийн өндөр үнэлсэн газрууд"
            href="/search?sort=rating"
          />
          {topRated.length > 0 ? (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {topRated.map((b, i) => (
                <BusinessCard
                  key={b.id}
                  business={b}
                  saved={savedSet.has(b.id)}
                  priority={i < 4}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Газрууд удахгүй нэмэгдэнэ"
              description="Эхний бизнесүүд бүртгэгдмэгц энд харагдана."
              action={{ label: "Бизнес нэмэх", href: "/owner/businesses/new" }}
              compact
              className="mt-5"
            />
          )}
        </section>

        {/* ── New places ─────────────────────────────────────────────── */}
        {newest.length > 0 && (
          <section>
            <SectionHeading
              title="Шинээр нэмэгдсэн"
              subtitle="Сүүлд бүртгэгдсэн газрууд"
              href="/search?sort=newest"
            />
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {newest.map((b) => (
                <BusinessCard
                  key={b.id}
                  business={b}
                  saved={savedSet.has(b.id)}
                />
              ))}
            </div>
          </section>
        )}

        <PatternRule spacing="none" />

        {/* ── Explore by district ────────────────────────────────────── */}
        <section>
          <SectionHeading
            title="Дүүргээр хайх"
            subtitle="Улаанбаатарын дүүрэг бүрийн шилдэг газрууд"
          />
          <div className="mt-5">
            <DistrictChips counts={districtCounts} />
          </div>

          {/* Discovery call-outs */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/search?view=map"
              className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
            >
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPinned className="size-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-display font-semibold text-foreground">
                  Газрын зураг дээр үзэх
                </p>
                <p className="text-sm text-muted-foreground">
                  Ойролцоох газруудыг зурагнаас нь нээ
                </p>
              </div>
            </Link>
            <Link
              href="/search?openNow=true"
              className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
            >
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary-foreground">
                <Clock className="size-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-display font-semibold text-foreground">
                  Одоо нээлттэй газрууд
                </p>
                <p className="text-sm text-muted-foreground">
                  Яг одоо үйлчилж буй газруудыг ол
                </p>
              </div>
            </Link>
          </div>
        </section>
      </Container>
    </>
  );
}
