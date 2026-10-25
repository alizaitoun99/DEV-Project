import Link from "next/link";
import {
  Code, File, FolderOpen, ImageIcon, Layers, LinkIcon,
  Sparkles, Star, StickyNote, Terminal,
} from "lucide-react";
import { COLLECTIONS, CURRENT_USER, ITEMS, ITEM_TYPES } from "@/lib/mock-data";
import type { Collection } from "@/lib/mock-data";

const TYPE_STYLES = {
  snippet: { icon: Code, color: "text-blue-500", route: "snippets" },
  prompt: { icon: Sparkles, color: "text-violet-500", route: "prompts" },
  command: { icon: Terminal, color: "text-orange-500", route: "commands" },
  note: { icon: StickyNote, color: "text-yellow-300", route: "notes" },
  file: { icon: File, color: "text-gray-500", route: "files" },
  image: { icon: ImageIcon, color: "text-pink-500", route: "images" },
  link: { icon: LinkIcon, color: "text-emerald-500", route: "links" },
};

const linkClassName = "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-sidebar-foreground/85 outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring";

interface CollectionLinksProps {
  collections: Collection[];
}

function CollectionLinks({ collections }: CollectionLinksProps) {
  return collections.map((collection) => (
    <Link key={collection.id} href={`/collections/${collection.id}`} prefetch={false} className={linkClassName}>
      <FolderOpen aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{collection.name}</span>
      {collection.isFavorite && <Star aria-label="Favorite" className="ml-auto size-4 shrink-0 fill-yellow-400 text-yellow-400" />}
    </Link>
  ));
}

export function DashboardSidebar() {
  const recentCollections = COLLECTIONS.map((collection) => ({
    collection,
    lastOpened: Math.max(0, ...ITEMS.filter((item) => item.collectionIds.includes(collection.id))
      .map((item) => item.lastOpenedAt ? Date.parse(item.lastOpenedAt) : 0)),
  })).filter(({ lastOpened }) => lastOpened > 0)
    .sort((a, b) => b.lastOpened - a.lastOpened || a.collection.id.localeCompare(b.collection.id))
    .slice(0, 3).map(({ collection }) => collection);

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <Link href="/dashboard" className="flex h-[69px] shrink-0 items-center gap-3 border-b px-5 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring">
        <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600">
          <Layers aria-hidden="true" className="size-5 text-white" />
        </span>
        <span className="text-xl tracking-tight">DevStash</span>
      </Link>
      <nav aria-label="Dashboard navigation" className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4">
        <section aria-label="Types" className="px-3 pb-4">
          <h2 className="px-3 pb-2 text-xs font-medium text-muted-foreground">Types</h2>
          {ITEM_TYPES.map((type) => {
            const style = TYPE_STYLES[type.id as keyof typeof TYPE_STYLES];
            const Icon = style.icon;
            return (
              <Link key={type.id} href={`/items/${style.route}`} prefetch={false} className={linkClassName}>
                <Icon aria-hidden="true" className={`size-4 shrink-0 ${style.color}`} />
                <span>{type.name}</span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{ITEMS.filter((item) => item.typeId === type.id).length}</span>
              </Link>
            );
          })}
        </section>
        <section aria-label="Collections" className="space-y-4 border-t px-3 pt-4">
          <h2 className="px-3 text-xs font-medium text-muted-foreground">Collections</h2>
          <div>
            <h3 className="px-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Favorites</h3>
            <CollectionLinks collections={COLLECTIONS.filter((collection) => collection.isFavorite)} />
          </div>
          <div>
            <h3 className="px-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Recent collections</h3>
            <CollectionLinks collections={recentCollections} />
          </div>
          <Link href="/collections" prefetch={false} className={linkClassName}>All collections <span aria-hidden="true" className="ml-auto">→</span></Link>
        </section>
      </nav>
      <div className="flex shrink-0 items-center gap-3 border-t p-4">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-semibold text-violet-300">
          {CURRENT_USER.name.split(" ").map((name) => name[0]).join("")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{CURRENT_USER.name}</p>
          <p className="truncate text-xs text-muted-foreground">{CURRENT_USER.email}</p>
        </div>
        <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{CURRENT_USER.plan}</span>
      </div>
    </div>
  );
}
