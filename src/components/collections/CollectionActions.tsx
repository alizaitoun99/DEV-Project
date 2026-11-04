"use client";

import { FavoriteButton } from "@/components/FavoriteButton";


import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertDialog, DropdownMenu } from "radix-ui";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateCollection, deleteCollection } from "@/actions/collections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface CollectionActionsProps {
  collection: { id: string; name: string; description: string | null; isFavorite: boolean };
  menu?: boolean;
}

export function CollectionActions({ collection, menu = false }: CollectionActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const trigger = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<"edit" | "delete" | null>(null);
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description ?? "");
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);

  function open(next: "edit" | "delete" | null) {
    if (saving.current) return;
    setMode(next);
    setName(collection.name);
    setDescription(collection.description ?? "");
    setError(null);
  }

  async function submit() {
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    setError(null);
    try {
      const result = mode === "delete" ? await deleteCollection(collection.id) : await updateCollection(collection.id, { name, description });
      if (!result.success) { setError(result.error); toast.error(result.error); return; }
      setMode(null);
      toast.success(mode === "delete" ? "Collection deleted. Items retained." : "Collection updated");
      if (mode === "delete" && pathname === `/collections/${collection.id}`) router.replace("/collections");
      router.refresh();
    } catch {
      const message = "Unable to update collection. Please try again.";
      setError(message);
      toast.error(message);
    } finally { saving.current = false; setPending(false); }
  }

  const itemClass = "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:cursor-default data-[disabled]:opacity-50";
  const restoreFocus = (event: Event) => { event.preventDefault(); trigger.current?.focus(); };

  return <>
    {menu ? <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild><Button ref={trigger} variant="ghost" size="icon" aria-label={`Actions for ${collection.name}`}><Ellipsis aria-hidden="true" /></Button></DropdownMenu.Trigger>
      <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-48 rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl" onCloseAutoFocus={(event) => { if (mode) event.preventDefault(); }}>
        <DropdownMenu.Item className={itemClass} onSelect={() => open("edit")}><Pencil aria-hidden="true" className="size-4" />Edit</DropdownMenu.Item>
        <DropdownMenu.Item className={`${itemClass} text-destructive`} onSelect={() => open("delete")}><Trash2 aria-hidden="true" className="size-4" />Delete</DropdownMenu.Item>
      </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root> : <div className="flex shrink-0 gap-1">
      <Button ref={trigger} variant="outline" size="icon" aria-label="Edit collection" onClick={() => open("edit")}><Pencil aria-hidden="true" /></Button>
      <Button variant="outline" size="icon" aria-label="Delete collection" onClick={() => open("delete")}><Trash2 aria-hidden="true" className="text-destructive" /></Button>
      <FavoriteButton kind="collection" id={collection.id} isFavorite={collection.isFavorite} />
    </div>}
    <Dialog open={mode === "edit"} onOpenChange={(value) => { if (!value) open(null); }}>
      <DialogContent aria-busy={pending} onCloseAutoFocus={restoreFocus}>
        <DialogTitle className="text-xl font-semibold">Edit collection</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">Update the collection name and description.</DialogDescription>
        <form action={submit} className="mt-6 space-y-6">
          {error && <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">{error}</p>}
          <fieldset disabled={pending} className="min-w-0 space-y-4">
            <label className="block space-y-2"><span className="text-sm font-medium">Name (required)</span><Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={500} /></label>
            <label className="block space-y-2"><span className="text-sm font-medium">Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={10000} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
          </fieldset>
          <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" disabled={pending} onClick={() => open(null)}>Cancel</Button><Button type="submit" disabled={pending || !name.trim()}>{pending ? "Saving…" : "Save changes"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <AlertDialog.Root open={mode === "delete"} onOpenChange={(value) => { if (!value) open(null); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-black/70" />
        <AlertDialog.Content aria-busy={pending} onCloseAutoFocus={restoreFocus} className="fixed left-1/2 top-1/2 z-[80] max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
          <AlertDialog.Title className="text-xl font-semibold">Delete collection?</AlertDialog.Title>
          <AlertDialog.Description className="break-words text-sm text-muted-foreground">Delete “{collection.name}”? All items will be kept in your library and in their other collections. Only this collection and its memberships will be removed. This cannot be undone.</AlertDialog.Description>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <form action={submit} className="flex flex-wrap justify-end gap-3"><AlertDialog.Cancel asChild><Button type="button" variant="outline" disabled={pending}>Cancel</Button></AlertDialog.Cancel><Button type="submit" variant="destructive" disabled={pending}>{pending ? "Deleting…" : "Delete collection"}</Button></form>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  </>;
}
