import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businesses,
  businessContacts,
  businessHours,
  businessPhotos,
} from "@/db/schema";
import { idSchema } from "@/lib/validations";
import { CATEGORY_TAXONOMY } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { OwnerPageHeader } from "../../../_components/page-header";
import {
  EditBusinessForm,
  type CategoryOption,
  type EditFormValues,
  type HourRow,
} from "./_components/edit-business-form";
import {
  PhotoManager,
  type ManagedPhoto,
} from "./_components/photo-manager";

export const metadata: Metadata = {
  title: "Мэдээлэл засах",
};

/** Flatten the taxonomy into grouped leaf options for the category select. */
const CATEGORY_OPTIONS: CategoryOption[] = CATEGORY_TAXONOMY.flatMap((parent) =>
  (parent.children ?? []).map((c) => ({
    slug: c.slug,
    nameMn: c.nameMn,
    group: parent.nameMn,
  })),
);

/** Find the leaf slug whose primary-category id matches the business. */
function slugForCategoryName(nameMn: string | null): string | undefined {
  if (!nameMn) return undefined;
  return CATEGORY_OPTIONS.find((c) => c.nameMn === nameMn)?.slug;
}

export default async function EditBusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) notFound();

  const session = await auth();
  const userId = session!.user.id;

  // Load the business + ownership check in one query.
  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, parsed.data),
  });
  if (!business || business.status === "DELETED") notFound();

  // Server-side ownership guard (defence-in-depth beyond middleware).
  if (business.ownerUserId !== userId) {
    redirect("/owner/businesses");
  }

  const [contact, hours, photos, categoryRow] = await Promise.all([
    db.query.businessContacts.findFirst({
      where: eq(businessContacts.businessId, business.id),
    }),
    db.query.businessHours.findMany({
      where: eq(businessHours.businessId, business.id),
    }),
    db.query.businessPhotos.findMany({
      where: eq(businessPhotos.businessId, business.id),
      orderBy: (p, { desc, asc }) => [desc(p.isCover), asc(p.sortOrder)],
    }),
    business.primaryCategoryId
      ? db.query.categories.findFirst({
          where: (c, { eq: eqf }) => eqf(c.id, business.primaryCategoryId!),
          columns: { nameMn: true },
        })
      : Promise.resolve(undefined),
  ]);

  const defaultValues: EditFormValues = {
    name: business.name,
    description: business.description ?? "",
    primaryCategorySlug: slugForCategoryName(categoryRow?.nameMn ?? null),
    priceLevel: business.priceLevel ?? undefined,
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    website: contact?.website ?? "",
    facebookUrl: contact?.facebookUrl ?? "",
    instagramUrl: contact?.instagramUrl ?? "",
    addressText: undefined,
    district: undefined,
    khoroo: undefined,
    latitude: undefined,
    longitude: undefined,
  };

  // Location lives in its own table — fetch and merge.
  const location = await db.query.businessLocations.findFirst({
    where: (l, { eq: eqf }) => eqf(l.businessId, business.id),
  });
  if (location) {
    defaultValues.addressText = location.addressText ?? "";
    defaultValues.district = location.district ?? undefined;
    defaultValues.khoroo = location.khoroo ?? "";
    defaultValues.latitude = location.latitude ?? undefined;
    defaultValues.longitude = location.longitude ?? undefined;
  }

  const initialHours: HourRow[] = hours.map((h) => ({
    dayOfWeek: h.dayOfWeek,
    openTime: h.openTime ? h.openTime.slice(0, 5) : null,
    closeTime: h.closeTime ? h.closeTime.slice(0, 5) : null,
    isClosed: h.isClosed,
  }));

  const managedPhotos: ManagedPhoto[] = photos
    .filter((p) => p.status !== "REJECTED")
    .map((p) => ({
      id: p.id,
      imageUrl: p.imageUrl,
      caption: p.caption,
      isCover: p.isCover,
      status: p.status,
    }));

  return (
    <div>
      <OwnerPageHeader title={business.name} description="Бизнесийн мэдээллийг засах">
        <Button asChild variant="ghost" size="sm">
          <Link href="/owner/businesses">
            <ArrowLeft className="size-4" />
            Буцах
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/business/${business.slug}`} target="_blank">
            <ExternalLink className="size-4" />
            Профайл үзэх
          </Link>
        </Button>
      </OwnerPageHeader>

      <div className="space-y-6">
        <EditBusinessForm
          businessId={business.id}
          categories={CATEGORY_OPTIONS}
          defaultValues={defaultValues}
          initialHours={initialHours}
        />

        <PhotoManager businessId={business.id} initialPhotos={managedPhotos} />
      </div>
    </div>
  );
}
