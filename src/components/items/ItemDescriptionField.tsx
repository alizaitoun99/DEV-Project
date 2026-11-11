"use client";

import { useContext, useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generateItemDescription } from "@/actions/ai";
import { ItemPlanContext } from "@/components/items/ItemPlanContext";
import { Button } from "@/components/ui/button";

interface ItemDescriptionFieldProps {
  value: string;
  onChange: (description: string) => void;
  context: {
    type: string;
    title: string;
    tags: string;
    content?: string;
    language?: string;
    url?: string;
    fileName?: string;
    fileMimeType?: string;
  };
}

export function ItemDescriptionField({ value, onChange, context }: ItemDescriptionFieldProps) {
  const id = useId();
  const isPro = useContext(ItemPlanContext);
  const [pending, setPending] = useState(false);
  const requesting = useRef(false);
  const edited = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const { type, ...details } = context;
  const hasDetails = [value, ...Object.values(details)].some((detail) => detail?.trim());

  async function generate() {
    if (requesting.current || !hasDetails) return;
    requesting.current = true;
    edited.current = false;
    setPending(true);
    try {
      const result = await generateItemDescription({
        type,
        ...details,
        content: details.content?.trim().slice(0, 2000),
        description: value.trim().slice(0, 2000),
        tags: details.tags.trim().slice(0, 1000),
      });
      if (!active.current) return;
      if (!result.success) toast.error(result.error);
      else if (!edited.current) onChange(result.data);
    } catch {
      if (active.current) toast.error("Unable to generate a description right now. Please try again.");
    } finally {
      requesting.current = false;
      if (active.current) setPending(false);
    }
  }

  return <div className="space-y-2">
    <div className="flex min-h-5 items-center justify-between gap-2">
      <label htmlFor={id} className="text-sm font-medium">Description</label>
      {isPro && <Button type="button" variant="ghost" size="icon-sm"
        aria-label="Generate description" aria-describedby={`${id}-hint`} title="Generate description"
        disabled={pending || !hasDetails} onClick={generate}>
        {pending ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : <Sparkles aria-hidden="true" />}
      </Button>}
    </div>
    <textarea id={id} rows={3} maxLength={10000} value={value} onChange={(event) => {
      edited.current = true;
      onChange(event.target.value);
    }} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
    {isPro && <p id={`${id}-hint`} className="text-xs text-muted-foreground">Generation sends current item details to OpenAI.</p>}
    <span role="status" className="sr-only">{pending ? "Generating description." : ""}</span>
  </div>;
}
