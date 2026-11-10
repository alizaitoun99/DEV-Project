"use client";

import { FavoriteButton } from "@/components/FavoriteButton";
import { PinButton } from "@/components/PinButton";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { removeItemFromCollection } from "@/actions/items";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Copy, Pencil, X } from "lucide-react";
import { DeleteItemDialog } from "@/components/items/DeleteItemDialog";
import { toast } from "sonner";
import type { ItemDetail } from "@/lib/db/items";
import { ItemEditForm } from "@/components/items/ItemEditForm";
import { TypeIcon } from "@/components/dashboard/TypeIcon";
import { CodeEditor } from "@/components/items/CodeEditor";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

interface Selection { id: string; title: string; }
interface ItemDrawerProviderProps { children: ReactNode; }
const DrawerContext = createContext<((item: Selection, trigger: HTMLButtonElement) => void) | null>(null);
export function useItemDrawer() {
  return useContext(DrawerContext);
}
const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" });

export function ItemDrawerTrigger({ id, title }: Selection) {
  const open = useContext(DrawerContext);
  return <button type="button" aria-label={`View ${title}`} aria-haspopup="dialog" onClick={(event) => open?.({ id, title }, event.currentTarget)} className="absolute inset-0 z-10 cursor-pointer rounded-xl outline-none hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring" />;
}

export function ItemDrawerProvider({ children }: ItemDrawerProviderProps) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const trigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!selection) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/items/${encodeURIComponent(selection!.id)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 404 ? "Item not found." : response.status === 401 ? "Your session expired. Sign in again." : "Unable to load item. Please try again.");
        const result: { data: ItemDetail } = await response.json();
        if (!controller.signal.aborted) setItem(result.data);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load item.");
      }
    }
    void load();
    return () => controller.abort();
  }, [selection, attempt]);

  function open(next: Selection, element: HTMLButtonElement) {
    trigger.current = element;
    setItem(null);
    setError(null);
    setSelection(next);
  }

  return <DrawerContext.Provider value={open}>
    {children}
    <Sheet open={Boolean(selection)} onOpenChange={(open) => { if (!open) setSelection(null); }}>
      <SheetContent onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }}>
        <header className="border-b p-6 pr-12">
          <div className="flex items-start gap-3">
            {item && <span className="rounded-lg bg-muted p-3"><TypeIcon typeId={item.type.slug} label={item.type.name} /></span>}
            <div className="min-w-0">
              <SheetTitle className="break-words text-xl font-semibold">{item?.title ?? selection?.title ?? "Item details"}</SheetTitle>
              <SheetDescription className="sr-only">Saved item details</SheetDescription>
              {item && <p className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded bg-muted px-2 py-1">{item.type.name}</span>{item.language && <span className="rounded border px-2 py-1">{item.language}</span>}</p>}
            </div>
          </div>
        </header>
        {error ? <div role="alert" className="space-y-4 p-6"><p>{error}</p><Button variant="outline" onClick={() => { setError(null); setAttempt((value) => value + 1); }}>Try again</Button></div> : !item ? <div role="status" className="space-y-6 p-6"><span className="sr-only">Loading item details</span>{["h-10", "h-20", "h-48", "h-16"].map((height) => <div key={height} className={`${height} animate-pulse rounded-lg bg-muted motion-reduce:animate-none`} />)}</div> : <ItemDetails key={item.id} item={item} onSaved={setItem} onDeleted={() => { setSelection(null); setItem(null); }} />}
      </SheetContent>
    </Sheet>
  </DrawerContext.Provider>;
}

interface ItemDetailsProps { item: ItemDetail; onSaved: (item: ItemDetail) => void; onDeleted: () => void; }

function ItemDetails({ item, onSaved, onDeleted }: ItemDetailsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const text = item.content ?? item.url;
  async function copy() {
    try {
      await navigator.clipboard.writeText(text ?? "");
      toast.success("Copied to clipboard");
    } catch { toast.error("Unable to copy. Please try again."); }
  }
  async function removeMembership(collectionId: string) {
    setRemoving(true);
    try {
      const result = await removeItemFromCollection(item.id, collectionId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onSaved({ ...item, collections: item.collections.filter(({ collection }) => collection.id !== collectionId) });
      router.refresh();
    } catch {
      toast.error("Unable to remove the item from this collection.");
    } finally {
      setRemoving(false);
    }
  }
  if (editing) return <ItemEditForm item={item} onCancel={() => setEditing(false)} onSaved={(updated) => { onSaved(updated); setEditing(false); }} />;
  const safeUrl = item.url && /^https?:\/\//i.test(item.url) ? item.url : null;
  return <>
    <div aria-label="Item actions" className="flex flex-wrap items-center gap-1 border-b px-4 py-4">
      <FavoriteButton kind="item" id={item.id} isFavorite={item.isFavorite} onSaved={(isFavorite) => onSaved({ ...item, isFavorite })} />
      <PinButton id={item.id} isPinned={item.isPinned} onSaved={(isPinned) => onSaved({ ...item, isPinned })} />
      <Button variant="ghost" disabled={!text} onClick={copy}><Copy />Copy</Button>
      {item.fileName && <Button variant="ghost" asChild><a href={`/api/items/${encodeURIComponent(item.id)}/download`}>Download</a></Button>}
      <Button variant="ghost" onClick={() => setEditing(true)}><Pencil />Edit</Button>
      <DeleteItemDialog id={item.id} title={item.title} onDeleted={onDeleted} />
    </div>
    <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-6 [overflow-wrap:anywhere]">
      <section><h3 className="mb-3 text-sm text-muted-foreground">Description</h3><p className="whitespace-pre-wrap text-sm">{item.description || "No description"}</p></section>
      {item.type.slug === "image" && item.fileName && (["image/png", "image/jpeg", "image/gif", "image/webp"].includes(item.fileMimeType ?? "") ? <Image unoptimized src={`/api/items/${encodeURIComponent(item.id)}/download?preview=1`} width={1000} height={750} alt={item.title} className="max-h-80 w-full rounded-lg object-contain" /> : <p className="rounded-lg border p-4 text-sm text-muted-foreground">Preview unavailable for this format. Download the original above.</p>)}
      {item.content !== null && <section><h3 className="mb-3 text-sm text-muted-foreground">Content</h3>{["snippet", "command"].includes(item.type.slug) ? <CodeEditor value={item.content} language={item.language ?? ""} readOnly /> : ["note", "prompt"].includes(item.type.slug) ? <MarkdownEditor value={item.content} readOnly /> : <pre className="max-w-full overflow-x-auto rounded-lg border bg-muted/30 p-4 text-sm"><code>{item.content}</code></pre>}</section>}
      {item.url && <section><h3 className="mb-3 text-sm text-muted-foreground">URL</h3>{safeUrl ? <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{item.url}</a> : <p className="text-sm">{item.url}</p>}</section>}
      {item.fileName && <section><h3 className="mb-3 text-sm text-muted-foreground">File</h3><p className="text-sm">{item.fileName}</p><p className="mt-1 text-xs text-muted-foreground">{[item.fileMimeType, item.fileSize !== null ? `${item.fileSize} bytes` : null].filter(Boolean).join(" · ")}</p></section>}
      <section className="border-t pt-6"><h3 className="mb-3 text-sm text-muted-foreground">Tags</h3><div className="flex flex-wrap gap-2">{item.tags.length ? item.tags.map(({ tag }) => <span key={tag.name} className="rounded bg-muted px-2 py-1 text-xs">{tag.name}</span>) : <p className="text-sm">No tags</p>}</div></section>
      <section>
        <h3 className="mb-3 text-sm text-muted-foreground">Collections</h3>
        <div className="flex flex-wrap gap-2">
          {item.collections.length ? item.collections.map(({ collection }) => (
            <span key={collection.id} className="inline-flex items-center gap-1 rounded border pl-2 text-xs">
              {collection.name}
              <Button type="button" size="icon-sm" variant="ghost" disabled={removing}
                aria-label={`Remove from ${collection.name}`} onClick={() => void removeMembership(collection.id)}>
                <X aria-hidden="true" />
              </Button>
            </span>
          )) : <p className="text-sm">No collections</p>}
        </div>
      </section>
      <section><h3 className="mb-3 text-sm text-muted-foreground">Details</h3><dl className="space-y-2 text-sm">{[["Created", item.createdAt], ["Updated", item.updatedAt]].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">{label}</dt><dd><time dateTime={value}>{dateFormat.format(new Date(value))}</time></dd></div>)}</dl></section>
    </div>
  </>;
}
