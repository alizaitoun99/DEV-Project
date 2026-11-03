"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateItem } from "@/actions/items";
import type { ItemDetail } from "@/lib/db/items";
import { CodeEditor } from "@/components/items/CodeEditor";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ItemEditFormProps { item: ItemDetail; onCancel: () => void; onSaved: (item: ItemDetail) => void; }

export function ItemEditForm({ item, onCancel, onSaved }: ItemEditFormProps) {
  const router = useRouter();
  const [fields, setFields] = useState({ title: item.title, description: item.description ?? "", content: item.content ?? "", language: item.language ?? "", url: item.url ?? "", tags: item.tags.map(({ tag }) => tag.name).join(", ") });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const textType = ["snippet", "prompt", "command", "note"].includes(item.type.slug);
  const languageType = ["snippet", "command"].includes(item.type.slug);
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await updateItem(item.id, {
        title: fields.title, description: fields.description || null,
        ...(textType ? { content: fields.content || null } : {}),
        ...(languageType ? { language: fields.language || null } : {}),
        ...(item.type.slug === "link" ? { url: fields.url.trim() || null } : {}),
        tags: fields.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
      if (!result.success) { setError(result.error); toast.error(result.error); return; }
      if (active.current) onSaved(result.data);
      toast.success("Item saved");
      router.refresh();
    } catch { setError("Unable to save item. Please try again."); toast.error("Unable to save item. Please try again."); }
    finally { saving.current = false; setPending(false); }
  }
  function field(name: keyof typeof fields, label: string, multiline = false) {
    const className = "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
    return <label className="block space-y-2"><span className="text-sm font-medium">{label}</span>{multiline ? <textarea className={className} rows={name === "content" ? 12 : 3} value={fields[name]} disabled={pending} onChange={(event) => setFields({ ...fields, [name]: event.target.value })} /> : <Input autoFocus={name === "title"} required={name === "title"} value={fields[name]} disabled={pending} onChange={(event) => setFields({ ...fields, [name]: event.target.value })} />}</label>;
  }
  return <form action={save} className="flex min-h-0 flex-1 flex-col">
    <div className="flex gap-2 border-b p-4"><Button type="submit" disabled={pending || !fields.title.trim()}>{pending ? "Saving…" : "Save"}</Button><Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button></div>
    <fieldset disabled={pending} className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
      {error && <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">{error}</p>}
      {field("title", "Title")}{field("description", "Description", true)}
      {languageType ? <CodeEditor value={fields.content} language={fields.language} readOnly={pending} onChange={(content) => setFields((current) => ({ ...current, content }))} /> : textType && <MarkdownEditor value={fields.content} disabled={pending} onChange={(content) => setFields((current) => ({ ...current, content }))} />}{languageType && field("language", "Language")}
      {item.type.slug === "link" && field("url", "URL")}{field("tags", "Tags (comma-separated)")}
      <section className="space-y-2 text-sm [overflow-wrap:anywhere]"><h3 className="text-muted-foreground">Collections</h3><p>{item.collections.map(({ collection }) => collection.name).join(", ") || "No collections"}</p></section>
      <dl className="space-y-2 text-sm"><dt className="text-muted-foreground">Created</dt><dd>{new Date(item.createdAt).toLocaleString()}</dd><dt className="text-muted-foreground">Updated</dt><dd>{new Date(item.updatedAt).toLocaleString()}</dd></dl>
    </fieldset>
  </form>;
}
