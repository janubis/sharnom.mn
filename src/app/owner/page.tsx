import type { Metadata } from "next";
import Link from "next/link";
import {
  Eye,
  Phone,
  Navigation,
  Globe,
  Store,
  Star,
  Pencil,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { formatCount, formatRating } from "@/lib/utils";
import {
  listOwnerBusinesses,
  getOwnerBusinessAnalytics,
  type OwnerBusinessAnalytics,
} from "@/db/queries/owner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { OwnerPageHeader } from "./_components/page-header";
import { KpiCard } from "./_components/kpi-card";
import { MiniBars } from "./_components/mini-bars";

export const metadata: Metadata = {
  title: "Бизнесийн самбар",
};

type Totals = OwnerBusinessAnalytics["totals"];

const ZERO_TOTALS: Totals = {
  profileViews: 0,
  phoneClicks: 0,
  directionClicks: 0,
  websiteClicks: 0,
  mapPinClicks: 0,
  saves: 0,
};

/** Verification badge text + variant for a business row. */
function verificationBadge(status: string) {
  switch (status) {
    case "VERIFIED":
      return { label: "Баталгаажсан", variant: "success" as const };
    case "CLAIMED":
      return { label: "Эзэмшсэн", variant: "secondary" as const };
    default:
      return { label: "Баталгаажаагүй", variant: "outline" as const };
  }
}

export default async function OwnerDashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const businesses = await listOwnerBusinesses(userId);

  // Pull 30-day analytics for every owned business in parallel.
  const analytics = await Promise.all(
    businesses.map((b) => getOwnerBusinessAnalytics(b.id, 30)),
  );

  // Aggregate totals across all owned businesses.
  const totals: Totals = analytics.reduce<Totals>((acc, a) => {
    acc.profileViews += a.totals.profileViews;
    acc.phoneClicks += a.totals.phoneClicks;
    acc.directionClicks += a.totals.directionClicks;
    acc.websiteClicks += a.totals.websiteClicks;
    acc.mapPinClicks += a.totals.mapPinClicks;
    acc.saves += a.totals.saves;
    return acc;
  }, { ...ZERO_TOTALS });

  // Build a combined 30-day daily profile-view series (merge per-day across businesses).
  const viewsByDate = new Map<string, number>();
  for (const a of analytics) {
    for (const point of a.viewSeries) {
      viewsByDate.set(point.date, (viewsByDate.get(point.date) ?? 0) + point.views);
    }
  }
  const trend = [...viewsByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, views]) => ({
      label: date.slice(5), // MM-DD
      value: views,
    }));

  return (
    <div>
      <OwnerPageHeader
        title="Бизнесийн самбар"
        description="Сүүлийн 30 хоногийн идэвх, таны бизнесүүдийн товч мэдээлэл"
      >
        <Button asChild variant="secondary">
          <Link href="/owner/claim">
            <ShieldCheck className="size-4" />
            Бизнес эзэмших
          </Link>
        </Button>
      </OwnerPageHeader>

      {businesses.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Та одоогоор бизнес эзэмшээгүй байна"
          description="Бизнесээ эзэмшсэнээр энд статистик, сэтгэгдэл, мэдээллийн засварыг удирдах боломжтой."
          action={{ label: "Бизнесээ эзэмших", href: "/owner/claim" }}
        />
      ) : (
        <div className="space-y-8">
          {/* KPI cards */}
          <section
            aria-label="30 хоногийн үзүүлэлт"
            className="grid grid-cols-2 gap-4 lg:grid-cols-4"
          >
            <KpiCard
              icon={Eye}
              label="Профайл үзэлт"
              value={totals.profileViews}
              tone="primary"
              hint="Сүүлийн 30 хоног"
            />
            <KpiCard
              icon={Phone}
              label="Утасны товшилт"
              value={totals.phoneClicks}
              tone="success"
              hint="Сүүлийн 30 хоног"
            />
            <KpiCard
              icon={Navigation}
              label="Чиглэлийн товшилт"
              value={totals.directionClicks}
              tone="secondary"
              hint="Сүүлийн 30 хоног"
            />
            <KpiCard
              icon={Globe}
              label="Вэбсайтын товшилт"
              value={totals.websiteClicks}
              tone="soyombo"
              hint="Сүүлийн 30 хоног"
            />
          </section>

          {/* View trend */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Профайл үзэлтийн график</CardTitle>
              <span className="text-xs text-muted-foreground">Өдрөөр, 30 хоног</span>
            </CardHeader>
            <CardContent>
              <MiniBars data={trend} emptyLabel="Энэ хугацаанд үзэлт бүртгэгдээгүй байна" />
            </CardContent>
          </Card>

          {/* Owned businesses list */}
          <section aria-label="Миний бизнесүүд" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
                Миний бизнесүүд
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({businesses.length})
                </span>
              </h2>
            </div>

            <div className="space-y-3">
              {businesses.map((b, i) => {
                const a = analytics[i]!;
                const badge = verificationBadge(b.verificationStatus);
                return (
                  <Card
                    key={b.id}
                    className="flex flex-col gap-4 p-5 transition-shadow hover:shadow-card-hover sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-foreground">{b.name}</h3>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Star className="size-3.5 fill-secondary text-secondary" />
                          {formatRating(b.ratingAvg)}{" "}
                          <span className="text-muted-foreground/70">
                            ({formatCount(b.reviewCount)})
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="size-3.5" />
                          {formatCount(a.totals.profileViews)} үзэлт
                        </span>
                        {b.district && <span className="truncate">{b.district}</span>}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/business/${b.slug}`} target="_blank">
                          <ExternalLink className="size-4" />
                          Үзэх
                        </Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link href={`/owner/businesses/${b.id}/edit`}>
                          <Pencil className="size-4" />
                          Засах
                        </Link>
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
