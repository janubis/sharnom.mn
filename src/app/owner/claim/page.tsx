import type { Metadata } from "next";
import Link from "next/link";
import { inArray } from "drizzle-orm";
import { Clock, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { listUserClaims, type ClaimStatus } from "@/db/queries/claims";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OwnerPageHeader } from "../_components/page-header";
import { ClaimWizard } from "./_components/claim-wizard";

export const metadata: Metadata = {
  title: "Бизнес эзэмших",
};

const STATUS_META: Record<
  ClaimStatus,
  { label: string; variant: "warning" | "success" | "outline"; icon: typeof Clock }
> = {
  PENDING: { label: "Хүлээгдэж байна", variant: "warning", icon: Clock },
  APPROVED: { label: "Зөвшөөрөгдсөн", variant: "success", icon: CheckCircle2 },
  REJECTED: { label: "Татгалзсан", variant: "outline", icon: XCircle },
};

const METHOD_LABEL: Record<string, string> = {
  PHONE: "Утсаар",
  EMAIL: "И-мэйлээр",
  DOCUMENT: "Бичиг баримтаар",
  MANUAL: "Гар аргаар",
};

export default async function OwnerClaimPage() {
  const session = await auth();
  const userId = session!.user.id;

  const claims = await listUserClaims(userId);

  // Resolve business names/slugs for the listed claims.
  const bizIds = [...new Set(claims.map((c) => c.businessId))];
  const bizRows = bizIds.length
    ? await db.query.businesses.findMany({
        where: inArray(businesses.id, bizIds),
        columns: { id: true, name: true, slug: true },
      })
    : [];
  const bizById = new Map(bizRows.map((b) => [b.id, b]));

  return (
    <div>
      <OwnerPageHeader
        title="Бизнес эзэмших"
        description="Бизнесээ хайж олоод, эзэмших хүсэлт илгээгээрэй. Манай баг хянаж баталгаажуулна."
      />

      <div className="space-y-8">
        <ClaimWizard />

        {/* Existing claims status */}
        <section aria-label="Миний хүсэлтүүд" className="space-y-4">
          <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
            Миний хүсэлтүүд
            {claims.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({claims.length})
              </span>
            )}
          </h2>

          {claims.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ShieldCheck className="size-6" />
                </span>
                <p className="text-sm text-muted-foreground">
                  Та одоогоор эзэмших хүсэлт илгээгээгүй байна.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {claims.map((claim) => {
                const meta = STATUS_META[claim.status];
                const biz = bizById.get(claim.businessId);
                const StatusIcon = meta.icon;
                return (
                  <Card key={claim.id}>
                    <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {biz ? (
                            <Link
                              href={`/business/${biz.slug}`}
                              target="_blank"
                              className="truncate font-semibold text-primary hover:underline"
                            >
                              {biz.name}
                            </Link>
                          ) : (
                            <span className="truncate font-semibold text-foreground">
                              Бизнес
                            </span>
                          )}
                          <Badge variant={meta.variant}>
                            <StatusIcon className="size-3" />
                            {meta.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {claim.verificationMethod && (
                            <span>
                              Арга: {METHOD_LABEL[claim.verificationMethod] ?? claim.verificationMethod}
                            </span>
                          )}
                          <span>
                            Илгээсэн: {new Date(claim.createdAt).toLocaleDateString("mn-MN")}
                          </span>
                        </div>
                        {claim.note && (
                          <p className="text-sm text-foreground/80">{claim.note}</p>
                        )}
                        {claim.status === "REJECTED" && claim.adminNote && (
                          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                            Шийдвэр: {claim.adminNote}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
