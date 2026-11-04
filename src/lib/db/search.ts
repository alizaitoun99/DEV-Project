import "server-only";

import { getCollections } from "@/lib/db/collections";
import { getSearchItems } from "@/lib/db/items";
import type { SearchData } from "@/types/search";

export async function getSearchData(userId: string): Promise<SearchData> {
  const [items, collections] = await Promise.all([getSearchItems(userId), getCollections(userId)]);
  return { items, collections: collections.map(({ id, name, itemCount }) => ({ id, name, itemCount })) };
}
