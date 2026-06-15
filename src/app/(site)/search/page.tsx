import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { searchParamsSchema } from "@/lib/validations";
import { searchBusinesses } from "@/lib/search";
import type { SortOption } from "@/lib/constants";
import { UB_CENTER, APP_NAME } from "@/lib/constants";
import { getMapPins } from "@/db/queries/map";
import { getCategoryTree } from "@/db/queries/categories";
import type { MapBounds } from "@/lib/maps/provider";

import { ResultsList } from "./_components/results-list";
import { SearchTracker } from "./_components/search-tracker";
import type {
  SearchFilters,
  CategoryOption,
} from "./_components/filter-panel";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const title = q ? `“${q}” — хайлт` : "Газар хайх";
  return {
    title,
    description: q
      ? `Улаанбаатарт “${q}” холбоотой газрууд — сэтгэгдэл, үнэлгээ, газрын зурагтай. | ${APP_NAME}`
      : "Улаанбаатар хотын ресторан, кафе, үйлчилгээ, дэлгүүрүүдийг шүүж хайх. Газрын зураг, сэтгэгдэл, үнэлгээтэй.",
    // Search result pages are not canonical landing pages.
    robots: { index: false, follow: true },
  };
}

/** Build a default viewport around a centre point (~6km box). */
function boundsAround(lat: number, lng: number): MapBounds {
  const dLat = 0.06;
  const dLng = 0.09;
  return {
    south: lat - dLat,
    north: lat + dLat,
    west: lng - dLng,
    east: lng + dLng,
  };
}

/** Flatten the two-level category tree into grouped options for the filter. */
function toCategoryOptions(
  tree: Awaited<ReturnType<typeof getCategoryTree>>,
): CategoryOption[] {
  const out: CategoryOption[] = [];
  for (const parent of tree) {
    for (const child of parent.children) {
      out.push({
        slug: child.slug,
        nameMn: child.nameMn,
        icon: child.icon,
        group: parent.nameMn,
      });
    }
  }
  return out;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const raw = await searchParams;
  const parsed = searchParamsSchema.safeParse(raw);
  const params = parsed.success ? parsed.data : {};

  const query = params.q ?? "";
  const geo =
    params.lat != null && params.lng != null
      ? { lat: params.lat, lng: params.lng }
      : null;

  const sort: SortOption = params.sort ?? (geo ? "nearest" : "recommended");

  const filters: SearchFilters = {
    category: params.category,
    district: params.district,
    minRating: params.minRating,
    price: params.price ?? [],
    openNow: params.openNow ?? false,
    verified: params.verified ?? false,
    radius: params.radius ?? 5,
  };

  // Run the initial search + initial map pins server-side in parallel.
  const initialBounds = geo
    ? boundsAround(geo.lat, geo.lng)
    : boundsAround(UB_CENTER.lat, UB_CENTER.lng);

  const [result, pins, tree] = await Promise.all([
    searchBusinesses({
      q: query || undefined,
      categorySlug: filters.category,
      district: filters.district,
      minRating: filters.minRating,
      priceLevels: filters.price.length ? filters.price : undefined,
      openNow: filters.openNow,
      verifiedOnly: filters.verified,
      lat: geo?.lat,
      lng: geo?.lng,
      radiusKm: geo ? filters.radius : undefined,
      sort,
      page: params.page ?? 1,
    }),
    getMapPins({
      bounds: initialBounds,
      categorySlug: filters.category,
      district: filters.district,
      minRating: filters.minRating,
      openNow: filters.openNow,
      verifiedOnly: filters.verified,
      lat: geo?.lat,
      lng: geo?.lng,
    }),
    getCategoryTree(),
  ]);

  const categories = toCategoryOptions(tree);

  return (
    <Container size="lg" className="py-6 sm:py-8">
      <SearchTracker query={query} count={result.total} />
      <ResultsList
        initialResult={result}
        initialPins={pins}
        initialQuery={query}
        initialFilters={filters}
        initialSort={sort}
        geo={geo}
        categories={categories}
      />
    </Container>
  );
}
