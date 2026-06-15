import { Skeleton } from "@/components/ui/skeleton";

/** Generic admin page skeleton shown while server pages stream in. */
export default function AdminLoading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
        <div className="ulzii-rule mt-4" aria-hidden />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
