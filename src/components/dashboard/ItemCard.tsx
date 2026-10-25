import { Pin, Star } from "lucide-react";
import { ITEM_TYPES } from "@/lib/mock-data";
import type { Item } from "@/lib/mock-data";
import { getTypeStyle, TypeIcon } from "@/components/dashboard/TypeIcon";

interface ItemCardProps {
  item: Item;
}

const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function ItemCard({ item }: ItemCardProps) {
  const type = ITEM_TYPES.find((type) => type.id === item.typeId);
  return (
    <article className={`flex min-w-0 items-start gap-4 rounded-xl border border-l-2 bg-card/20 p-4 sm:p-5 ${getTypeStyle(item.typeId).border}`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
        <TypeIcon typeId={item.typeId} label={type?.name ?? item.typeId} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="break-words font-medium">{item.title}</h3>
          {item.isPinned && <Pin aria-label="Pinned item" className="size-3.5 shrink-0 text-muted-foreground" />}
          {item.isFavorite && <Star aria-label="Favorite item" className="size-4 shrink-0 fill-yellow-400 text-yellow-400" />}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
        <ul aria-label="Tags" className="mt-3 flex flex-wrap gap-2">
          {item.tags.map((tag) => <li key={tag} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{tag}</li>)}
        </ul>
        <time dateTime={item.updatedAt} className="mt-3 block text-xs text-muted-foreground sm:hidden">Updated {dateFormat.format(new Date(item.updatedAt))}</time>
      </div>
      <time dateTime={item.updatedAt} className="hidden shrink-0 pt-1 text-xs text-muted-foreground sm:block">{dateFormat.format(new Date(item.updatedAt))}</time>
    </article>
  );
}
