/**
 * Admin analytics — richer charts than the dashboard. Visits & searches over
 * time, map interactions (pin / direction / phone), top categories & districts,
 * most viewed / most reviewed businesses, highest-rated categories and top
 * search keywords. The `?range=` query (7|30|90 days) drives the time series.
 *
 * All charts are Recharts, lazy-loaded (ssr:false) via ./_components/lazy-charts.
 */
import Link from "next/link";
import { sql } from "drizzle-orm";
import { Eye, MessageSquare, Star, TrendingUp, Users2, Search } from "lucide-react";

import { db } from "@/db";
import {
  getTrafficSeries,
  getMapInteractionSeries,
  getTopSearches,
  getTopCategories,
  getTopDistricts,
  getMostViewedBusinesses,
  getMostReviewedBusinesses,
  getActiveUsers,
} from "@/db/queries/admin-stats";
import { formatRating, formatCount } from "@/lib/utils";
import { CategoryGlyph } from "@/components/business/category-icon";
import { AdminPageHeader } from "../_components/page-header";
import { Panel, PanelLink } from "../_components/panel";
import { StatCard } from "../_components/stat-card";
import {
  TrafficChart,
  MapInteractionChart,
  HorizontalBarChart,
} from "../_components/lazy-charts";
import { RangeTabs } from "./range-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Аналитик" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const ALLOWED_RANGES = new Set([7, 30, 90]);

type RatedCategory = {
  id: string;
  nameMn: string;
  slug: string;
  icon: string | null;
  ratingAvg: number;
  businessCount: number;
};

/**
 * Categories ranked by the average rating of their ACTIVE, reviewed businesses.
 * Requires a minimum of 3 rated businesses so a single 5-star outlier doesn't
 * dominate the leaderboard.
 */
async function getHighestRatedCategories(limit = 10): Promise<RatedCategory[]> {
  const rows = (await db.execute(sql`
    SELECT
      c.id, c.name_mn, c.slug, c.icon,
      AVG(b.rating_avg) AS rating_avg,
      COUNT(b.id)::int AS business_count
    FROM categories c
    JOIN businesses b
      ON b.primary_category_id = c.id
      AND b.status = 'ACTIVE'
      AND b.review_count > 0
    GROUP BY c.id
    HAVING COUNT(b.id) >= 3
    ORDER BY rating_avg DESC, business_count DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    id: string;
    name_mn: string;
    slug: string;
    icon: string | null;
    rating_avg: number;
    business_count: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    nameMn: r.name_mn,
    slug: r.slug,
    icon: r.icon,
    ratingAvg: Number(r.rating_avg),
    businessCount: Number(r.business_count),
  }));
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const requested = Number(first(sp.range));
  const days = ALLOWED_RANGES.has(requested) ? requested : 30;

  const [
    traffic,
    mapInteractions,
    topSearches,
    topCategories,
    topDistricts,
    mostViewed,
    mostReviewed,
    ratedCategories,
    active,
  ] = await Promise.all([
    getTrafficSeries(days),
    getMapInteractionSeries(days),
    getTopSearches(20, days),
    getTopCategories(10),
    getTopDistricts(10),
    getMostViewedBusinesses(10),
    getMostReviewedBusinesses(10),
    getHighestRatedCategories(8),
    getActiveUsers(),
  ]);

  const totalPageViews = traffic.reduce((a, p) => a + p.pageViews, 0);
  const totalSearches = traffic.reduce((a, p) => a + p.searches, 0);
  const totalPinClicks = mapInteractions.reduce((a, p) => a + p.pinClicks, 0);

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        title="Аналитик"
        description={`Сүүлийн ${days} хоногийн дэлгэрэнгүй үзүүлэлт`}
        actions={<RangeTabs current={String(days)} />}
      />

      {/* Headline numbers for the window */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Нийт хандалт"
          value={totalPageViews}
          icon={Eye}
          tone="primary"
          compact
        />
        <StatCard
          label="Нийт хайлт"
          value={totalSearches}
          icon={Search}
          tone="secondary"
          compact
        />
        <StatCard
          label="Газрын зураг дээрх даралт"
          value={totalPinClicks}
          icon={TrendingUp}
          tone="success"
          compact
        />
        <StatCard
          label="Идэвхтэй хэрэглэгч"
          value={active.mau}
          icon={Users2}
          tone="primary"
          compact
          hint={`Өдөр: ${active.dau} · 7 хоног: ${active.wau}`}
        />
      </div>

      {/* Time series */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Хандалт ба хайлт" description={`Сүүлийн ${days} хоног`}>
          <TrafficChart data={traffic} />
        </Panel>
        <Panel
          title="Газрын зургийн харилцан үйлдэл"
          description="Пин · чиглэл · утас"
        >
          <MapInteractionChart data={mapInteractions} />
        </Panel>
      </div>

      {/* Category / district bars */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Тэргүүлэх ангилал" description="Идэвхтэй бизнесийн тоогоор">
          {topCategories.length === 0 ? (
            <EmptyMini text="Ангиллын мэдээлэл алга." />
          ) : (
            <HorizontalBarChart
              tone="primary"
              data={topCategories.map((c) => ({
                label: c.nameMn,
                value: c.businessCount,
              }))}
            />
          )}
        </Panel>
        <Panel title="Тэргүүлэх дүүрэг" description="Идэвхтэй бизнесийн тоогоор">
          {topDistricts.length === 0 ? (
            <EmptyMini text="Дүүргийн мэдээлэл алга." />
          ) : (
            <HorizontalBarChart
              tone="secondary"
              data={topDistricts.map((d) => ({
                label: d.district,
                value: d.businessCount,
              }))}
            />
          )}
        </Panel>
      </div>

      {/* Leader lists */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Их хайгдсан түлхүүр үг"
          description={`Сүүлийн ${days} хоног`}
        >
          {topSearches.length === 0 ? (
            <EmptyMini text="Хайлтын мэдээлэл алга." />
          ) : (
            <ol className="space-y-1">
              {topSearches.map((s, i) => (
                <li
                  key={`${s.query}-${i}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                >
                  <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm text-foreground">
                    {s.query}
                  </span>
                  <span
                    className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground"
                    title={`Дунджаар ${s.avgResults} үр дүн`}
                  >
                    {s.count}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel
          title="Хамгийн их үзэгдсэн"
          action={<PanelLink href="/admin/businesses?sort=popular">Бүгд</PanelLink>}
        >
          {mostViewed.length === 0 ? (
            <EmptyMini text="Мэдээлэл алга." />
          ) : (
            <ul className="space-y-1">
              {mostViewed.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                >
                  <Link
                    href={`/business/${b.slug}`}
                    target="_blank"
                    className="flex-1 truncate text-sm text-foreground hover:underline"
                  >
                    {b.name}
                  </Link>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-muted-foreground">
                    <Eye className="size-3.5" />
                    {formatCount(b.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Хамгийн их сэтгэгдэлтэй">
          {mostReviewed.length === 0 ? (
            <EmptyMini text="Мэдээлэл алга." />
          ) : (
            <ul className="space-y-1">
              {mostReviewed.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                >
                  <Link
                    href={`/business/${b.slug}`}
                    target="_blank"
                    className="flex-1 truncate text-sm text-foreground hover:underline"
                  >
                    {b.name}
                  </Link>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-muted-foreground">
                    <MessageSquare className="size-3.5" />
                    {formatCount(b.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Highest-rated categories */}
      <div className="mt-6">
        <Panel
          title="Хамгийн өндөр үнэлгээтэй ангилал"
          description="Дор хаяж 3 үнэлгээтэй бизнестэй ангиллууд"
        >
          {ratedCategories.length === 0 ? (
            <EmptyMini text="Хангалттай үнэлгээтэй ангилал алга." />
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {ratedCategories.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                >
                  <CategoryGlyph name={c.icon ?? undefined} className="size-4 text-primary" />
                  <Link
                    href={`/admin/businesses?category=${c.slug}`}
                    className="flex-1 truncate text-sm text-foreground hover:underline"
                  >
                    {c.nameMn}
                  </Link>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-foreground">
                    <Star className="size-3.5 fill-secondary text-secondary" />
                    {formatRating(c.ratingAvg)}
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {c.businessCount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>
  );
}
