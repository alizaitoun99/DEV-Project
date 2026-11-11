import { Pagination } from "@/components/Pagination";
import { getPagination, parsePage, ITEMS_PER_PAGE, type PaginationSearchParams } from "@/lib/pagination";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ItemCard } from "@/components/dashboard/ItemCard";
import { CreateItemDialog } from "@/components/items/CreateItemDialog";
import { FileListRow } from "@/components/items/FileListRow";
import { Button } from "@/components/ui/button";
import type { ItemCreateInput } from "@/lib/item-validation";
import { getCurrentUser } from "@/lib/current-user";
import { getFilesByType, getItemsByType, getSystemItemTypes } from "@/lib/db/items";

const TYPE_ROUTES: Record<string, ItemCreateInput["type"] | "file" | "image"> = {
  snippets: "snippet",
  prompts: "prompt",
  commands: "command",
  notes: "note",
  files: "file",
  images: "image",
  links: "link",
};

interface ItemsPageProps {
  searchParams: Promise<PaginationSearchParams>;
  params: Promise<{ type: string }>;
}

export const metadata: Metadata = { title: "Items | DevStash" };

export default async function ItemsPage({ params, searchParams }: ItemsPageProps) {
  await connection();
  const user = await getCurrentUser();
  const { type: route } = await params;
  const slug = Object.hasOwn(TYPE_ROUTES, route) ? TYPE_ROUTES[route] : undefined;
  if (!slug) notFound();

  if (user.plan === "FREE" && (slug === "file" || slug === "image")) {
    const title = slug === "file" ? "Files" : "Images";

    return (
      <section aria-labelledby="upgrade-title" className="mx-auto max-w-xl space-y-4 rounded-xl border bg-card p-6 sm:p-8">
        <p className="text-sm font-medium text-primary">DevStash Pro</p>
        <h1 id="upgrade-title" className="text-3xl font-semibold tracking-tight">{title} are a Pro feature</h1>
        <p className="text-muted-foreground">Upgrade to upload and organize {route} in your workspace.</p>
        <Button asChild size="lg">
          <Link href="/upgrade">Upgrade to Pro</Link>
        </Button>
      </section>
    );
  }

  const types = await getSystemItemTypes(user.id);
  const type = types.find((type) => type.slug === slug);
  if (!type) notFound();
  const query = await searchParams;
  const count = type._count.items;
  const pagination = getPagination(count, parsePage(query.page), ITEMS_PER_PAGE);
  const files = slug === "file" ? await getFilesByType(user.id, type.id, pagination.skip) : null;
  const items = files ? [] : await getItemsByType(user.id, type.id, pagination.skip);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{type.name}</h1>
          <p className="mt-2 text-muted-foreground">{count} {count === 1 ? "item" : "items"}</p>
        </div>
        <CreateItemDialog defaultType={slug} triggerLabel={`Add ${slug}`} />
      </div>
      {files && files.length > 0 ? (
        <ul aria-label="Files" className="space-y-2">
          {files.map((file) => <li key={file.id}><FileListRow {...file} fileSize={file.fileSize?.toString() ?? null} createdAt={file.createdAt.toISOString()} /></li>)}
        </ul>
      ) : items.length > 0 ? (
        <div className={slug === "image" ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" : "grid grid-cols-1 gap-4 md:grid-cols-2"}>
          {items.map((item) => <ItemCard key={item.id} item={item} />)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Your saved {route} will appear here.</p>
      )}
      <Pagination {...pagination} pathname={`/items/${route}`} searchParams={query} />
    </div>
  );
}
