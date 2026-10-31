export default function ItemsLoading() {
  return (
    <div role="status" className="mx-auto max-w-7xl animate-pulse space-y-6">
      <span className="sr-only">Loading items…</span>
      <div className="h-9 w-40 rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-40 rounded-xl border bg-card/20" />
        ))}
      </div>
    </div>
  );
}
