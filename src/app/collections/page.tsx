import { Pagination } from "@/components/Pagination";
import { getPagination, parsePage, COLLECTIONS_PER_PAGE, type PaginationSearchParams } from "@/lib/pagination";
import type { Metadata } from "next";
import { connection } from "next/server";
import { CollectionCard } from "@/components/dashboard/CollectionCard";
import { getCurrentUser } from "@/lib/current-user";
import { getCollections, getCollectionStats } from "@/lib/db/collections";

export const metadata: Metadata = { title: "Collections | DevStash" };

interface CollectionsPageProps {
  searchParams: Promise<PaginationSearchParams>;
}

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  await connection();
  const user = await getCurrentUser();
  const query = await searchParams;
  const { total } = await getCollectionStats(user.id);
  const pagination = getPagination(total, parsePage(query.page), COLLECTIONS_PER_PAGE);
  const collections = await getCollections(user.id, COLLECTIONS_PER_PAGE, pagination.skip);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Collections</h1>
        <p className="mt-2 text-muted-foreground">{total} {total === 1 ? "collection" : "collections"}</p>
      </div>
      {collections.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => <CollectionCard key={collection.id} collection={collection} />)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Your collections will appear here. Create a collection to organize your items.</p>
      )}
      <Pagination {...pagination} pathname={"/collections"} searchParams={query} />
    </div>
  );
}
