/**
 * Admin business editor. Loads the full business with location/contact/hours and
 * renders an admin-powered edit form plus lifecycle/verification controls.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { db } from "@/db";
import {
  businesses,
  businessContacts,
  businessHours,
  businessLocations,
  categories,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import type { UserRole } from "@/db/schema";
import { getCategoryTree } from "@/db/queries/categories";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "../../_components/page-header";
import { BusinessStatusBadge, VerificationBadge } from "../../_components/status-badge";
import { BusinessEditForm, type CategoryOption } from "./business-edit-form";
import { StatusControls } from "./status-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Бизнес засах" };

export default async function AdminBusinessEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const admin = isAdmin((session?.user?.role ?? "MODERATOR") as UserRole);

  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, id),
  });
  if (!business) notFound();

  const [location, contact, hours, tree, category] = await Promise.all([
    db.query.businessLocations.findFirst({
      where: eq(businessLocations.businessId, id),
    }),
    db.query.businessContacts.findFirst({
      where: eq(businessContacts.businessId, id),
    }),
    db.query.businessHours.findMany({
      where: eq(businessHours.businessId, id),
      orderBy: [asc(businessHours.dayOfWeek)],
    }),
    getCategoryTree(),
    business.primaryCategoryId
      ? db.query.categories.findFirst({
          where: and(eq(categories.id, business.primaryCategoryId)),
          columns: { slug: true },
        })
      : Promise.resolve(undefined),
  ]);

  // Only leaf categories are selectable as a primary category.
  const categoryOptions: CategoryOption[] = tree.flatMap((parent) =>
    parent.children.map((c) => ({
      slug: c.slug,
      label: `${parent.nameMn} · ${c.nameMn}`,
    })),
  );

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        title={business.name}
        description={`/${business.slug}`}
        actions={
          <>
            <BusinessStatusBadge status={business.status} />
            <VerificationBadge status={business.verificationStatus} />
            <Button asChild variant="outline" size="sm">
              <Link href={`/business/${business.slug}`} target="_blank">
                <ExternalLink className="size-4" />
                Үзэх
              </Link>
            </Button>
          </>
        }
      >
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/admin/businesses">
            <ArrowLeft className="size-4" />
            Жагсаалт руу буцах
          </Link>
        </Button>
      </AdminPageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <BusinessEditForm
            business={business}
            location={location ?? null}
            contact={contact ?? null}
            hours={hours}
            categoryOptions={categoryOptions}
            currentCategorySlug={category?.slug ?? null}
          />
        </div>

        <aside className="space-y-6">
          {admin && <StatusControls business={business} />}
        </aside>
      </div>
    </div>
  );
}
