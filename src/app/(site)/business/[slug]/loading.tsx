export default function BusinessDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <div className="mb-4 flex gap-2">
        <div className="shimmer h-4 w-12 rounded bg-muted" />
        <div className="shimmer h-4 w-20 rounded bg-muted" />
        <div className="shimmer h-4 w-32 rounded bg-muted" />
      </div>

      {/* Gallery */}
      <div className="shimmer aspect-[16/9] w-full rounded-2xl bg-muted sm:aspect-[21/9]" />

      {/* Header */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="shimmer h-8 w-2/3 rounded bg-muted" />
        <div className="shimmer h-4 w-1/2 rounded bg-muted" />
        <div className="shimmer h-4 w-2/5 rounded bg-muted" />
        <div className="mt-2 flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shimmer h-10 w-28 rounded-xl bg-muted" />
          ))}
        </div>
      </div>

      <div className="ulzii-rule my-6" aria-hidden />

      {/* Body */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="shimmer h-6 w-32 rounded bg-muted" />
          <div className="flex flex-col gap-2">
            <div className="shimmer h-4 w-full rounded bg-muted" />
            <div className="shimmer h-4 w-11/12 rounded bg-muted" />
            <div className="shimmer h-4 w-3/4 rounded bg-muted" />
          </div>

          <div className="shimmer h-32 w-full rounded-2xl bg-muted" />

          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 py-2">
              <div className="shimmer size-11 shrink-0 rounded-full bg-muted" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="shimmer h-4 w-40 rounded bg-muted" />
                <div className="shimmer h-3 w-24 rounded bg-muted" />
                <div className="shimmer h-4 w-full rounded bg-muted" />
                <div className="shimmer h-4 w-5/6 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>

        <aside className="flex flex-col gap-6 lg:col-span-1">
          <div className="shimmer h-64 w-full rounded-2xl bg-muted" />
          <div className="shimmer h-72 w-full rounded-2xl bg-muted" />
        </aside>
      </div>
    </div>
  );
}
