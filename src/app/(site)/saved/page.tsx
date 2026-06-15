import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/common/section-heading";
import { BusinessCard } from "@/components/business/business-card";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";

import { getCurrentUser } from "@/lib/auth";
import { listSavedBusinesses } from "@/db/queries/saved";
import { PAGE_SIZE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Хадгалсан газрууд",
  description: "Таны хадгалсан газрууд.",
  robots: { index: false, follow: false },
};

type SavedPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function SavedPage({ searchParams }: SavedPageProps) {
  const user = await getCurrentUser();
  if (!user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/saved")}`);
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const result = await listSavedBusinesses(user.id, page, PAGE_SIZE);

  return (
    <Container className="py-8 sm:py-10">
      <SectionHeading
        as="h1"
        title="Хадгалсан газрууд"
        subtitle={
          result.total > 0 ? `${result.total} газар` : undefined
        }
      />

      {result.items.length > 0 ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((b) => (
              <BusinessCard key={b.id} business={b} saved />
            ))}
          </div>

          <Pagination
            className="mt-8"
            page={result.page}
            total={result.total}
            pageSize={result.pageSize}
            buildHref={(p) => `/saved?page=${p}`}
          />
        </>
      ) : (
        <EmptyState
          icon={Heart}
          title="Та одоогоор газар хадгалаагүй байна"
          description="Дуртай газруудаа зүрх дээр дарж хадгалаарай — дараа нь энд хялбар олно."
          action={{ label: "Газар хайх", href: "/search" }}
          secondaryAction={{ label: "Нүүр хуудас", href: "/" }}
          className="mt-8"
        />
      )}
    </Container>
  );
}
