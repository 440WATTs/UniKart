export default function Loading() {
  return (
    <div className="container-page py-8" role="status" aria-label="Loading">
      <div className="mb-6 h-8 w-56 animate-pulse rounded bg-black/10" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-line bg-white">
            <div className="aspect-square animate-pulse bg-black/5" />
            <div className="space-y-2 p-3">
              <div className="h-5 w-1/2 animate-pulse rounded bg-black/10" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-black/5" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
