import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Owner-area route skeleton — mirrors the dashboard layout. */
export default function OwnerLoading() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="mt-4 h-8 w-20" />
            <Skeleton className="mt-2 h-4 w-24" />
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card className="mt-8">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>

      {/* List */}
      <div className="mt-8 space-y-3">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="flex items-center justify-between p-5">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-9 w-24 rounded-lg" />
          </Card>
        ))}
      </div>
    </div>
  );
}
