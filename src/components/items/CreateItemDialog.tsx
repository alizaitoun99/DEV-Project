"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createItem } from "@/actions/items";
import { CodeEditor } from "@/components/items/CodeEditor";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { CollectionSelector } from "@/components/items/CollectionSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ItemCreateInput } from "@/lib/item-validation";
import { FileUpload, sendFile, uploadRequest } from "@/components/items/FileUpload";
import { uploadMime } from "@/lib/upload-validation";

type CreateType = ItemCreateInput["type"] | "file" | "image";

const initialFields = { title: "", description: "", content: "", language: "", url: "", tags: "" };

interface CreateItemDialogProps {
  defaultType?: CreateType;
  triggerLabel?: string;
}

export function CreateItemDialog({ defaultType = "snippet", triggerLabel = "New Item" }: CreateItemDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CreateType>(defaultType);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [fields, setFields] = useState(initialFields);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  function changeOpen(value: boolean) {
    if (saving.current) return;
    setOpen(value);
    setFields(initialFields);
    setCollectionIds([]);
    setType(defaultType);
    setError(null);
    setFile(null);
    setProgress(null);
  }

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    setError(null);
    try {
      const input = {
        type, title: fields.title, description: fields.description || null,
        ...(type === "link" ? { url: fields.url.trim() || null } : { content: fields.content || null }),
        ...(["snippet", "command"].includes(type) ? { language: fields.language || null } : {}),
        collectionIds,
        tags: fields.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      };
      let result;
      if (type === "file" || type === "image") {
        if (!file) throw new Error("Choose a file first.");
        const upload = await uploadRequest({ action: "begin", file: { type, fileName: file.name, size: file.size, mime: file.type } });
        try {
          setProgress(0);
          await sendFile(upload.signedUrl!, file, uploadMime(file.name), setProgress);
          setProgress(100);
          await uploadRequest({ action: "finish", id: upload.id, item: input });
          result = { success: true };
        } catch (uploadError) {
          await uploadRequest({ action: "abandon", id: upload.id }).catch(() => {});
          throw uploadError;
        }
      } else { result = await createItem(input); }
      if (!result.success) { const message = result.error ?? "Unable to create item."; setError(message); toast.error(message); return; }
      setOpen(false);
      toast.success("Item created");
      router.refresh();
    } catch (error) {
      setProgress(null);
      const message = error instanceof Error ? error.message : "Unable to create item. Please try again.";
      setError(message);
      toast.error(message);
    } finally { saving.current = false; setPending(false); }
  }

  function field(name: keyof typeof fields, label: string, multiline = false) {
    const shared = { value: fields[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFields({ ...fields, [name]: event.target.value }) };
    return <label className="block space-y-2"><span className="text-sm font-medium">{label}</span>
      {multiline ? <textarea {...shared} rows={name === "content" ? 8 : 3} maxLength={name === "content" ? 500000 : 10000} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /> : <Input {...shared} required={name === "title" || name === "url"} type={name === "url" ? "url" : "text"} maxLength={name === "title" ? 500 : name === "language" ? 100 : undefined} />}
    </label>;
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button className="h-11 shrink-0 sm:ml-auto"><Plus aria-hidden="true" />{triggerLabel}</Button></DialogTrigger>
    <DialogContent aria-busy={pending}>
      <DialogTitle className="text-xl font-semibold">New Item</DialogTitle>
      <DialogDescription className="mt-2 text-sm text-muted-foreground">Save knowledge, files, and images to your private workspace.</DialogDescription>
      <form action={save} className="mt-6 space-y-6">
        {error && <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">{error}</p>}
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          <label className="block space-y-2"><span className="text-sm font-medium">Type</span><select value={type} onChange={(event) => { setType(event.target.value as CreateType); setError(null); setFile(null); setProgress(null); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring">
            <option value="snippet">Snippet</option><option value="prompt">Prompt</option><option value="command">Command</option><option value="note">Note</option><option value="link">Link</option>
            <option value="file">File</option><option value="image">Image</option>
          </select></label>
          {field("title", "Title (required)")}{field("description", "Description", true)}
          {type === "file" || type === "image" ? <FileUpload type={type} file={file} onChange={setFile} disabled={pending} progress={progress} /> : type === "link" ? field("url", "URL (required)") : ["snippet", "command"].includes(type) ? <CodeEditor value={fields.content} language={fields.language} readOnly={pending} onChange={(content) => setFields((current) => ({ ...current, content }))} /> : <MarkdownEditor key={type} value={fields.content} disabled={pending} onChange={(content) => setFields((current) => ({ ...current, content }))} />}
          {["snippet", "command"].includes(type) && field("language", "Language")}
          {field("tags", "Tags (comma-separated)")}
          {open && <CollectionSelector value={collectionIds} onChange={setCollectionIds} disabled={pending} />}
        </fieldset>
        <div className="flex flex-wrap justify-end gap-3">
          <DialogClose asChild><Button type="button" variant="outline" disabled={pending}>Cancel</Button></DialogClose>
          <Button type="submit" disabled={pending || !fields.title.trim() || ((type === "file" || type === "image") && !file)}>{pending ? "Creating…" : "Create item"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
