"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Folder, Search, X } from "lucide-react";
import { TypeIcon } from "@/components/dashboard/TypeIcon";
import { useItemDrawer } from "@/components/items/ItemDrawerProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { SearchData, SearchItem } from "@/types/search";

interface SearchPaletteProps { data: SearchData | null; }

export function SearchPalette({ data }: SearchPaletteProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pendingItem = useRef<SearchItem | null>(null);
  const openItem = useItemDrawer();
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey) || event.altKey || event.isComposing || event.repeat) return;
      // Avoid stacking the palette over another modal, such as an editor.
      if (!open && document.querySelector('[role="dialog"][data-state="open"]')) return;
      event.preventDefault();
      setOpen((value) => !value);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <button ref={trigger} type="button" aria-label="Search items and collections" className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-md bg-muted/50 px-3 text-left text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Search aria-hidden="true" className="size-4 shrink-0" /><span className="truncate">Search items and collections… ⌘K</span>
      </button>
    </DialogTrigger>
    <DialogContent className="overflow-hidden p-0" aria-describedby={undefined} onCloseAutoFocus={(event) => {
      event.preventDefault();
      const item = pendingItem.current;
      pendingItem.current = null;
      if (item && trigger.current) openItem?.(item, trigger.current);
      else trigger.current?.focus();
    }}>
      <DialogTitle className="sr-only">Search items and collections</DialogTitle>
      <DialogClose asChild><Button variant="ghost" size="icon" aria-label="Close search" className="absolute top-2 right-2 z-10"><X aria-hidden="true" /></Button></DialogClose>
      <Command loop label="Global search">
        <CommandInput autoFocus placeholder="Search items and collections…" />
        <CommandList>
          {data ? <>
            <CommandEmpty>No matching items or collections.</CommandEmpty>
            <CommandGroup heading="Items">
              {data.items.map((item) => <CommandItem key={item.id} value={`item:${item.id}`} keywords={[item.title, item.type.name, item.type.slug, item.preview]} onSelect={() => { pendingItem.current = item; setOpen(false); }}>
                <TypeIcon typeId={item.type.slug} label={item.type.name} />
                <span className="min-w-0 flex-1"><span className="block truncate">{item.title}</span>{item.preview && <span className="mt-1 block truncate text-xs text-muted-foreground">{item.preview}</span>}</span>
              </CommandItem>)}
            </CommandGroup>
            <CommandGroup heading="Collections">
              {data.collections.map((collection) => <CommandItem key={collection.id} value={`collection:${collection.id}`} keywords={[collection.name]} onSelect={() => { setOpen(false); router.push(`/collections/${encodeURIComponent(collection.id)}`); }}>
                <Folder aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{collection.name}</span><span className="shrink-0 text-xs text-muted-foreground">{collection.itemCount} {collection.itemCount === 1 ? "item" : "items"}</span>
              </CommandItem>)}
            </CommandGroup>
          </> : <div role="alert" className="space-y-3 p-4 text-sm"><p>Unable to load search. Please try again.</p><Button variant="outline" onClick={() => router.refresh()}>Try again</Button></div>}
        </CommandList>
      </Command>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">↑ ↓ to navigate · Enter to open · Esc to close</p>
    </DialogContent>
  </Dialog>;
}
