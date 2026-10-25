import { Pin, Star } from "lucide-react";
import type { ItemSummary } from "@/lib/db/items";
import { getTypeStyle, TypeIcon } from "@/components/dashboard/TypeIcon";

interface ItemCardProps {
  item: ItemSummary;
}

const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function ItemCard({ item }: ItemCardProps) {
  const updatedAt = item.updatedAt.toISOString();
  return (
    <article className={`flex min-w-0 items-start gap-4 rounded-xl border border-l-2 bg-card/20 p-4 sm:p-5 ${getTypeStyle(item.type.slug).border}`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
        <TypeIcon typeId={item.type.slug} label={item.type.name} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="break-words font-medium">{item.title}</h3>
          {item.isPinned && <Pin aria-label="Pinned item" className="size-3.5 shrink-0 text-muted-foreground" />}
          {item.isFavorite && <Star aria-label="Favorite item" className="size-4 shrink-0 fill-yellow-400 text-yellow-400" />}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        <ul aria-label="Tags" className="mt-3 flex flex-wrap gap-2">
          {item.tags.map(({ tag }) => <li key={tag.name} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{tag.name}</li>)}
        </ul>
        <time dateTime={updatedAt} className="mt-3 block text-xs text-muted-foreground sm:hidden">Updated {dateFormat.format(item.updatedAt)}</time>
      </div>
      <time dateTime={updatedAt} className="hidden shrink-0 pt-1 text-xs text-muted-foreground sm:block">{dateFormat.format(item.updatedAt)}</time>
    </article>
  );
}
