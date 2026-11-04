"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { CollectionCreateResponse } from "@/lib/collection-validation";

export function CreateCollectionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  function changeOpen(value: boolean) {
    if (saving.current) return;
    setOpen(value);
    setName("");
    setDescription("");
    setError(null);
  }

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const result: CollectionCreateResponse = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to create collection. Please try again.");
      setOpen(false);
      setName("");
      setDescription("");
      toast.success("Collection created");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create collection. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" className="h-11 shrink-0"><FolderPlus aria-hidden="true" />New Collection</Button></DialogTrigger>
    <DialogContent aria-busy={pending}>
      <DialogTitle className="text-xl font-semibold">New Collection</DialogTitle>
      <DialogDescription className="mt-2 text-sm text-muted-foreground">Organize your knowledge in a private collection.</DialogDescription>
      <form action={save} className="mt-6 space-y-6">
        {error && <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">{error}</p>}
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          <label className="block space-y-2"><span className="text-sm font-medium">Name (required)</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={500} />
          </label>
          <label className="block space-y-2"><span className="text-sm font-medium">Description</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={10000} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
        </fieldset>
        <div className="flex flex-wrap justify-end gap-3">
          <DialogClose asChild><Button type="button" variant="outline" disabled={pending}>Cancel</Button></DialogClose>
          <Button type="submit" disabled={pending || !name.trim()}>{pending ? "Creating…" : "Create collection"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
