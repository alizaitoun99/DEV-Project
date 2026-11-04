import type { Metadata } from "next";
import { connection } from "next/server";
import { CollectionCard } from "@/components/dashboard/CollectionCard";
import { getCurrentUser } from "@/lib/current-user";
import { getCollections } from "@/lib/db/collections";

export const metadata: Metadata = { title: "Collections | DevStash" };

export default async function CollectionsPage() {
  await connection();
  const user = await getCurrentUser();
  const collections = await getCollections(user.id);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Collections</h1>
        <p className="mt-2 text-muted-foreground">{collections.length} {collections.length === 1 ? "collection" : "collections"}</p>
      </div>
      {collections.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => <CollectionCard key={collection.id} collection={collection} />)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Your collections will appear here. Create a collection to organize your items.</p>
      )}
    </div>
  );
}
