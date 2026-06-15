import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";
import { BusinessCardSkeleton } from "@/components/business/business-card";

/** Search results skeleton: filter rail + result rows + map panel. */
export default function SearchLoading() {
  return (
    <Container size="lg" className="py-6 sm:py-8">
      <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        {/* Filter rail */}
        <aside className="hidden space-y-6 lg:block">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </aside>

        <div className="min-w-0">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,46%)] lg:gap-6">
            {/* List */}
            <div className="min-w-0">
              <div className="mb-4 flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-9 w-[170px] rounded-xl" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <BusinessCardSkeleton key={i} layout="row" />
                ))}
              </div>
            </div>

            {/* Map */}
            <div className="hidden lg:block">
              <Skeleton className="h-[calc(100vh-7rem)] w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
