/**
 * Structured-data (JSON-LD) builders for SEO.
 * Inject via a <script type="application/ld+json"> in server components.
 */
import { absoluteUrl } from "@/lib/utils";
import { DAYS_MN } from "@/lib/constants";

type LocalBusinessInput = {
  name: string;
  slug: string;
  description?: string | null;
  categoryName?: string | null;
  addressText?: string | null;
  district?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  website?: string | null;
  ratingAvg?: number;
  reviewCount?: number;
  priceLevel?: number | null;
  photos?: string[];
  hours?: { dayOfWeek: number; openTime: string | null; closeTime: string | null; isClosed: boolean }[];
};

const DAY_SCHEMA = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export function localBusinessJsonLd(b: LocalBusinessInput) {
  const json: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: b.name,
    url: absoluteUrl(`/business/${b.slug}`),
    "@id": absoluteUrl(`/business/${b.slug}`),
  };

  if (b.description) json.description = b.description;
  if (b.photos?.length) json.image = b.photos;
  if (b.phone) json.telephone = b.phone;
  if (b.website) json.sameAs = [b.website];
  if (b.priceLevel) json.priceRange = "₮".repeat(b.priceLevel);

  json.address = {
    "@type": "PostalAddress",
    streetAddress: b.addressText ?? undefined,
    addressLocality: b.district ?? undefined,
    addressRegion: b.city ?? "Улаанбаатар",
    addressCountry: "MN",
  };

  if (b.lat != null && b.lng != null) {
    json.geo = { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng };
  }

  if (b.reviewCount && b.reviewCount > 0 && b.ratingAvg) {
    json.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: b.ratingAvg.toFixed(1),
      reviewCount: b.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (b.hours?.length) {
    json.openingHoursSpecification = b.hours
      .filter((h) => !h.isClosed && h.openTime && h.closeTime)
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${DAY_SCHEMA[h.dayOfWeek]}`,
        opens: h.openTime,
        closes: h.closeTime,
      }));
  }

  return json;
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.url),
    })),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Mongol Local",
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/search")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

/** Helper to render JSON-LD safely. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// `DAYS_MN` re-exported for convenience in components rendering hours.
export { DAYS_MN };
