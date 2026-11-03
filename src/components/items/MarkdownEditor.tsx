"use client";

import { Copy } from "lucide-react";
import { Tabs } from "radix-ui";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface MarkdownEditorProps {
  value: string;
  readOnly?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
}

export function MarkdownEditor({ value, readOnly = false, disabled = false, onChange }: MarkdownEditorProps) {
  async function copy() {
    try { await navigator.clipboard.writeText(value); toast.success("Copied to clipboard"); }
    catch { toast.error("Unable to copy. Please try again."); }
  }

  const tabClass = "rounded px-3 py-1.5 text-sm text-zinc-400 data-[state=active]:bg-zinc-700 data-[state=active]:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return <Tabs.Root key={String(readOnly)} defaultValue={readOnly ? "preview" : "write"} className="min-w-0 overflow-hidden rounded-lg border border-zinc-700 bg-[#1e1e1e] text-zinc-100">
    <div className="flex h-11 items-center justify-between gap-2 border-b border-zinc-700 bg-[#2d2d2d] px-3">
      <Tabs.List aria-label="Markdown editor mode" className="flex gap-1">
        {!readOnly && <Tabs.Trigger type="button" value="write" className={tabClass}>Write</Tabs.Trigger>}
        <Tabs.Trigger type="button" value="preview" className={tabClass}>Preview</Tabs.Trigger>
      </Tabs.List>
      <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 hover:bg-zinc-800 hover:text-white" aria-label="Copy Markdown" disabled={disabled || !value} onClick={copy}><Copy className="size-4" /></Button>
    </div>
    {!readOnly && <Tabs.Content value="write" className="focus-visible:outline-none">
      <textarea aria-label="Markdown content" value={value} disabled={disabled} maxLength={500000} onChange={(event) => onChange?.(event.target.value)} className="block max-h-[352px] min-h-32 w-full resize-none overflow-y-auto bg-transparent p-4 font-mono text-sm [field-sizing:content] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50" />
    </Tabs.Content>}
    <Tabs.Content value="preview" tabIndex={0} className="markdown-preview max-h-[352px] min-h-32 overflow-auto p-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      {value ? <Markdown remarkPlugins={[remarkGfm]} skipHtml>{value}</Markdown> : <p className="text-zinc-500">Nothing to preview.</p>}
    </Tabs.Content>
  </Tabs.Root>;
}
