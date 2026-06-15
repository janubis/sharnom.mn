import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";
import { BusinessCardSkeleton } from "@/components/business/business-card";

/** Category landing skeleton: header + chips + business grid. */
export default function CategoryLoading() {
  return (
    <>
      <section className="felt-surface border-b border-border">
        <Container className="py-10 sm:py-12">
          <Skeleton className="mb-3 h-4 w-40" />
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-72" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-28 rounded-full" />
            ))}
          </div>
        </Container>
      </section>

      <Container className="space-y-10 py-10">
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-full" />
          ))}
        </div>
        <div>
          <Skeleton className="mb-5 h-7 w-56" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <BusinessCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
