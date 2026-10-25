export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading dashboard" className="mx-auto max-w-7xl animate-pulse space-y-10">
      <div className="h-20 rounded-xl bg-muted/40" />
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-xl border bg-card/30" />)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-44 rounded-xl border bg-card/20" />)}
      </div>
      <span className="sr-only">Loading dashboard…</span>
    </div>
  );
}
