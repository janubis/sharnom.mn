/**
 * Admin KPI dashboard — headline counters, traffic & map-interaction charts,
 * top search keywords and top categories / most-viewed lists.
 */
import Link from "next/link";
import {
  Store,
  Users,
  MessageSquare,
  Image as ImageIcon,
  Sparkles,
  BadgeCheck,
  Flag,
  TrendingUp,
  Eye,
  Star,
} from "lucide-react";

import {
  getAdminKpis,
  getTrafficSeries,
  getMapInteractionSeries,
  getTopSearches,
  getTopCategories,
  getMostViewedBusinesses,
  getActiveUsers,
} from "@/db/queries/admin-stats";
import { formatRating } from "@/lib/utils";
import { CategoryGlyph } from "@/components/business/category-icon";
import { AdminPageHeader } from "./_components/page-header";
import { StatCard } from "./_components/stat-card";
import { Panel, PanelLink } from "./_components/panel";
import { TrafficChart, MapInteractionChart } from "./_components/lazy-charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Хяналтын самбар" };

export default async function AdminDashboardPage() {
  const [kpis, traffic, mapInteractions, topSearches, topCategories, mostViewed, active] =
    await Promise.all([
      getAdminKpis(),
      getTrafficSeries(30),
      getMapInteractionSeries(30),
      getTopSearches(8, 30),
      getTopCategories(8),
      getMostViewedBusinesses(8),
      getActiveUsers(),
    ]);

  const pendingTotal = kpis.pendingClaims + kpis.pendingReports;

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        title="Хяналтын самбар"
        description="Сүүлийн 30 хоногийн үзүүлэлт, ачаалал ба хүлээгдэж буй ажлууд."
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Нийт бизнес"
          value={kpis.totalBusinesses}
          icon={Store}
          tone="primary"
          compact
          href="/admin/businesses"
        />
        <StatCard
          label="Хэрэглэгч"
          value={kpis.totalUsers}
          icon={Users}
          tone="secondary"
          compact
          hint={`Идэвхтэй (7 хоног): ${active.wau}`}
        />
        <StatCard
          label="Сэтгэгдэл"
          value={kpis.totalReviews}
          icon={MessageSquare}
          tone="success"
          compact
          href="/admin/reviews"
        />
        <StatCard
          label="Зураг"
          value={kpis.totalPhotos}
          icon={ImageIcon}
          tone="primary"
          compact
          href="/admin/photos"
        />
        <StatCard
          label="Өнөөдрийн шинэ бизнес"
          value={kpis.newBusinessesToday}
          icon={Sparkles}
          tone="secondary"
          hint={`Шинэ сэтгэгдэл: ${kpis.newReviewsToday}`}
        />
        <StatCard
          label="Хүлээгдэж буй хүсэлт"
          value={kpis.pendingClaims}
          icon={BadgeCheck}
          tone="warning"
          attention
          href="/admin/claims"
        />
        <StatCard
          label="Нээлттэй гомдол"
          value={kpis.pendingReports}
          icon={Flag}
          tone="soyombo"
          attention
          href="/admin/reports"
        />
        <StatCard
          label="Нийт хүлээгдэж буй"
          value={pendingTotal}
          icon={TrendingUp}
          tone="primary"
          attention
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Хандалт ба хайлт"
          description="Сүүлийн 30 хоног"
          action={<PanelLink href="/admin/analytics">Дэлгэрэнгүй</PanelLink>}
        >
          <TrafficChart data={traffic} />
        </Panel>
        <Panel title="Газрын зургийн харилцан үйлдэл" description="Сүүлийн 30 хоног">
          <MapInteractionChart data={mapInteractions} />
        </Panel>
      </div>

      {/* Lists */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Их хайгдсан түлхүүр үг"
          action={<PanelLink href="/admin/analytics">Бүгд</PanelLink>}
        >
          {topSearches.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Хайлтын мэдээлэл алга.
            </p>
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
                  <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    {s.count}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel
          title="Тэргүүлэх ангилал"
          action={<PanelLink href="/admin/categories">Удирдах</PanelLink>}
        >
          {topCategories.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ангиллын мэдээлэл алга.
            </p>
          ) : (
            <ul className="space-y-1">
              {topCategories.map((c) => (
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
                  <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    {c.businessCount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Хамгийн их үзэгдсэн">
          {mostViewed.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Мэдээлэл алга.
            </p>
          ) : (
            <ul className="space-y-1">
              {mostViewed.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                >
                  <span className="flex-1 truncate">
                    <Link
                      href={`/business/${b.slug}`}
                      target="_blank"
                      className="text-sm text-foreground hover:underline"
                    >
                      {b.name}
                    </Link>
                    <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                      <Star className="size-3 fill-secondary text-secondary" />
                      {formatRating(b.ratingAvg)}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-muted-foreground">
                    <Eye className="size-3.5" />
                    {b.value}
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
