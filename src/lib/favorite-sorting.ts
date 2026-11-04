export type FavoriteSort = "name-asc" | "name-desc" | "date-asc" | "date-desc" | "type-asc" | "type-desc";

export interface SortableFavorite {
  id: string;
  createdAt: Date;
  title?: string;
  name?: string;
  type?: { name: string };
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

export function sortFavorites<T extends SortableFavorite>(favorites: readonly T[], sort: FavoriteSort): T[] {
  const direction = sort.endsWith("desc") ? -1 : 1;
  const name = (favorite: T) => favorite.title ?? favorite.name ?? "";

  return [...favorites].sort((a, b) => {
    const comparison = sort.startsWith("date")
      ? a.createdAt.getTime() - b.createdAt.getTime()
      : collator.compare(sort.startsWith("type") ? a.type?.name ?? "" : name(a), sort.startsWith("type") ? b.type?.name ?? "" : name(b));

    return comparison * direction || collator.compare(name(a), name(b)) || a.id.localeCompare(b.id, "en");
  });
}
