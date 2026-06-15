import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";
import { BusinessCardSkeleton } from "@/components/business/business-card";

/** District landing skeleton: header + map + grouped grids. */
export default function DistrictLoading() {
  return (
    <>
      <section className="felt-surface border-b border-border">
        <Container className="py-10 sm:py-12">
          <Skeleton className="mb-3 h-4 w-40" />
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-80" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </Container>
      </section>

      <Container className="space-y-12 py-10">
        <Skeleton className="h-[340px] w-full rounded-2xl" />
        {Array.from({ length: 2 }).map((_, g) => (
          <div key={g}>
            <Skeleton className="mb-4 h-7 w-48" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <BusinessCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ))}
      </Container>
    </>
  );
}
