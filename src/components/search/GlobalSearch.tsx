import { connection } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getSearchData } from "@/lib/db/search";
import { SearchPalette } from "@/components/search/SearchPalette";
import type { SearchData } from "@/types/search";

export async function GlobalSearch() {
  await connection();
  const user = await getCurrentUser();
  let data: SearchData | null;
  try {
    data = await getSearchData(user.id);
  } catch {
    data = null;
  }
  return <SearchPalette data={data} />;
}
