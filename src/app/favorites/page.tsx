import type { Metadata } from "next";
import { connection } from "next/server";
import { FavoritesList } from "@/components/favorites/FavoritesList";
import { getCurrentUser } from "@/lib/current-user";
import { getFavorites } from "@/lib/db/favorites";

export const metadata: Metadata = { title: "Favorites | DevStash" };

export default async function FavoritesPage() {
  await connection();
  const user = await getCurrentUser();
  const favorites = await getFavorites(user.id);

  return <FavoritesList {...favorites} />;
}
