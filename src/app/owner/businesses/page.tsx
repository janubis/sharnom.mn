import type { Metadata } from "next";
import Link from "next/link";
import {
  Store,
  Star,
  Eye,
  Pencil,
  ExternalLink,
  MapPin,
  ImageIcon,
  ShieldCheck,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { formatCount, formatRating } from "@/lib/utils";
import { listOwnerBusinesses } from "@/db/queries/owner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { OwnerPageHeader } from "../_components/page-header";

export const metadata: Metadata = {
  title: "Миний бизнесүүд",
};

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

export default async function OwnerBusinessesPage() {
  const session = await auth();
  const userId = session!.user.id;
  const businesses = await listOwnerBusinesses(userId);

  return (
    <div>
      <OwnerPageHeader
        title="Миний бизнесүүд"
        description="Та эзэмшиж буй бүх бизнесүүд"
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
          description="Бизнесээ эзэмшсэнээр мэдээллээ засах, сэтгэгдэлд хариулах боломжтой болно."
          action={{ label: "Бизнесээ эзэмших", href: "/owner/claim" }}
        />
      ) : (
        <div className="space-y-3">
          {businesses.map((b) => {
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
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3.5 fill-secondary text-secondary" />
                      {formatRating(b.ratingAvg)}{" "}
                      <span className="text-muted-foreground/70">
                        ({formatCount(b.reviewCount)})
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3.5" />
                      {formatCount(b.viewCount)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="size-3.5" />
                      {formatCount(b.photoCount)}
                    </span>
                    {b.district && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="size-3.5" />
                        {b.district}
                      </span>
                    )}
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
      )}
    </div>
  );
}
