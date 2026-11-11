"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { generateAutoTags } from "@/actions/ai";
import { ItemPlanContext } from "@/components/items/ItemPlanContext";
import { Button } from "@/components/ui/button";

interface TagSuggestionsProps {
  itemType: string;
  title: string;
  content: string;
  tags: string;
  onAccept: (tag: string) => void;
}

export function TagSuggestions(props: TagSuggestionsProps) {
  const isPro = useContext(ItemPlanContext);
  if (!isPro) return null;
  const content = props.content.slice(0, 2000);
  return <SuggestionControls key={JSON.stringify([props.itemType, props.title, content])} {...props} content={content} />;
}

function SuggestionControls({ title, content, tags, onAccept }: TagSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const requesting = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const existing = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  const visible = suggestions.filter((tag) => !existing.some((name) => name.toLowerCase() === tag));
  const full = existing.length >= 50;

  async function suggest() {
    if (requesting.current) return;
    requesting.current = true;
    setPending(true);
    setSuggestions([]);
    try {
      const result = await generateAutoTags({ title, content });
      if (!active.current) return;
      if (result.success) setSuggestions(result.data);
      else toast.error(result.error);
    } catch {
      if (active.current) toast.error("Unable to suggest tags right now. Please try again.");
    } finally {
      requesting.current = false;
      if (active.current) setPending(false);
    }
  }

  function dismiss(tag: string) {
    setSuggestions((current) => current.filter((suggestion) => suggestion !== tag));
  }

  return <div className="space-y-2">
    <Button type="button" variant="ghost" size="sm" disabled={pending || full || !title.trim()} onClick={suggest}>
      <Sparkles aria-hidden="true" />{pending ? "Suggesting tags…" : "Suggest Tags"}
    </Button>
    <p className="text-xs text-muted-foreground">Sends the title and up to 2,000 characters of item text to OpenAI.</p>
    <span role="status" className="sr-only">{pending ? "Suggesting tags." : visible.length ? `${visible.length} tag suggestions available.` : ""}</span>
    {suggestions.length > 0 && visible.length === 0 && <p className="text-sm text-muted-foreground">All suggested tags are already on this item.</p>}
    {visible.length > 0 && <ul aria-label="Suggested tags" className="flex flex-wrap gap-2">
      {visible.map((tag) => <li key={tag} className="flex max-w-full items-center gap-1 rounded-md border bg-muted pl-2 text-xs">
        <span className="min-w-0 break-all">{tag}</span>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Accept tag ${tag}`} disabled={full} onClick={() => { onAccept(tag); dismiss(tag); }}><Check aria-hidden="true" /></Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Reject tag ${tag}`} onClick={() => dismiss(tag)}><X aria-hidden="true" /></Button>
      </li>)}
    </ul>}
  </div>;
}
