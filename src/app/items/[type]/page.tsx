import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ItemCard } from "@/components/dashboard/ItemCard";
import { getCurrentUser } from "@/lib/current-user";
import { getItemsByType, getSystemItemTypes } from "@/lib/db/items";

const TYPE_ROUTES: Record<string, string> = {
  snippets: "snippet",
  prompts: "prompt",
  commands: "command",
  notes: "note",
  files: "file",
  images: "image",
  links: "link",
};

interface ItemsPageProps {
  params: Promise<{ type: string }>;
}

export const metadata: Metadata = { title: "Items | DevStash" };

export default async function ItemsPage({ params }: ItemsPageProps) {
  await connection();
  const user = await getCurrentUser();
  const { type: route } = await params;
  const slug = Object.hasOwn(TYPE_ROUTES, route) ? TYPE_ROUTES[route] : undefined;
  if (!slug) notFound();

  const types = await getSystemItemTypes(user.id);
  const type = types.find((type) => type.slug === slug);
  if (!type) notFound();
  const items = await getItemsByType(user.id, type.id);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{type.name}</h1>
        <p className="mt-2 text-muted-foreground">{items.length} {items.length === 1 ? "item" : "items"}</p>
      </div>
      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((item) => <ItemCard key={item.id} item={item} />)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Your saved {route} will appear here.</p>
      )}
    </div>
  );
}
