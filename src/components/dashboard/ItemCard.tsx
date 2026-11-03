import { Pin, Star } from "lucide-react";
import { ImageThumbnail } from "@/components/items/ImageThumbnail";
import { ItemDrawerTrigger } from "@/components/items/ItemDrawerProvider";
import type { ItemSummary } from "@/lib/db/items";
import { getTypeStyle, TypeIcon } from "@/components/dashboard/TypeIcon";

interface ItemCardProps {
  item: ItemSummary;
}

const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function ItemCard({ item }: ItemCardProps) {
  const updatedAt = item.updatedAt.toISOString();
  if (item.type.slug === "image") return (
    <article className={`group relative min-w-0 overflow-hidden rounded-xl border border-l-2 bg-card/20 ${getTypeStyle(item.type.slug).border}`}>
      <ItemDrawerTrigger id={item.id} title={item.title} />
      <ImageThumbnail id={item.id} title={item.title} mime={item.fileMimeType} />
      <div className="space-y-2 p-4">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 break-words font-medium">{item.title}</h3>
          {item.isPinned && <Pin aria-label="Pinned item" className="mt-1 size-3.5 shrink-0 text-muted-foreground" />}
          {item.isFavorite && <Star aria-label="Favorite item" className="mt-1 size-4 shrink-0 fill-yellow-400 text-yellow-400" />}
        </div>
        {item.description && <p className="line-clamp-2 break-words text-sm text-muted-foreground">{item.description}</p>}
        {item.tags.length > 0 && <ul aria-label="Tags" className="flex flex-wrap gap-2">
          {item.tags.map(({ tag }) => <li key={tag.name} className="break-all rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{tag.name}</li>)}
        </ul>}
        <time dateTime={updatedAt} className="block text-xs text-muted-foreground">Updated {dateFormat.format(item.updatedAt)}</time>
      </div>
    </article>
  );
  return (
    <article className={`@container relative min-w-0 rounded-xl border border-l-2 bg-card/20 ${getTypeStyle(item.type.slug).border}`}>
      <ItemDrawerTrigger id={item.id} title={item.title} />
      <div className="flex min-w-0 items-start gap-2 p-3 @min-[320px]:gap-4 @min-[320px]:p-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 @min-[320px]:size-10">
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
          <time dateTime={updatedAt} className="mt-3 block text-xs text-muted-foreground @min-[480px]:hidden">Updated {dateFormat.format(item.updatedAt)}</time>
        </div>
        <time dateTime={updatedAt} className="hidden shrink-0 pt-1 text-xs text-muted-foreground @min-[480px]:block">{dateFormat.format(item.updatedAt)}</time>
      </div>
    </article>
  );
}
