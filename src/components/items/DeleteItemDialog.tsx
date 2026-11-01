"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "radix-ui";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteItem } from "@/actions/items";
import { Button } from "@/components/ui/button";

interface DeleteItemDialogProps { id: string; title: string; onDeleted: () => void; }

export function DeleteItemDialog({ id, title, onDeleted }: DeleteItemDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleting = useRef(false);

  async function remove() {
    if (deleting.current) return;
    deleting.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await deleteItem(id);
      if (!result.success) { setError(result.error); toast.error(result.error); return; }
      setOpen(false);
      onDeleted();
      toast.success("Item deleted");
      router.refresh();
    } catch {
      const message = "Unable to delete item. Please try again.";
      setError(message);
      toast.error(message);
    } finally { deleting.current = false; setPending(false); }
  }

  return <AlertDialog.Root open={open} onOpenChange={(value) => { if (!deleting.current) { setOpen(value); setError(null); } }}>
    <AlertDialog.Trigger asChild><Button variant="ghost" size="icon" aria-label="Delete item" className="ml-auto text-destructive"><Trash2 /></Button></AlertDialog.Trigger>
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-black/70" />
      <AlertDialog.Content aria-busy={pending} className="fixed left-1/2 top-1/2 z-[80] max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
        <AlertDialog.Title className="text-xl font-semibold">Delete item?</AlertDialog.Title>
        <AlertDialog.Description className="break-words text-sm text-muted-foreground">This permanently deletes “{title}” and removes it from all collections. This cannot be undone.</AlertDialog.Description>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <form action={remove} className="flex flex-wrap justify-end gap-3">
          <AlertDialog.Cancel asChild><Button type="button" variant="outline" disabled={pending}>Cancel</Button></AlertDialog.Cancel>
          <Button type="submit" variant="destructive" disabled={pending}>{pending ? "Deleting…" : "Delete item"}</Button>
        </form>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>;
}
