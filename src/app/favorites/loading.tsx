export default function FavoritesLoading() {
  return <div role="status" className="mx-auto max-w-5xl animate-pulse space-y-6 motion-reduce:animate-none">
    <span className="sr-only">Loading favorites…</span>
    <div className="h-8 w-40 bg-muted" />
    {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-10 border-b bg-muted/30" />)}
  </div>;
}
