"use client";

import { Crown, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Tooltip } from "radix-ui";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { applyPromptRevision, optimizePrompt } from "@/actions/ai";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { Button } from "@/components/ui/button";
import type { ItemDetail } from "@/lib/db/items";

interface PromptPreviewProps {
  itemId: string;
  value: string;
  isPro: boolean;
  onSaved: (item: ItemDetail) => void;
}

export function PromptPreview({ itemId, value, isPro, onSaved }: PromptPreviewProps) {
  const router = useRouter();
  const optimizeButton = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const [busy, setBusy] = useState<"review" | "save" | null>(null);
  const [review, setReview] = useState<{ original: string; revision: string | null } | null>(null);
  const currentReview = review?.original === value ? review : null;
  const canOptimize = isPro && Boolean(value.trim()) && !busy && !currentReview?.revision;

  async function optimize() {
    if (!canOptimize) return;
    setReview(null);
    setBusy("review");
    try {
      const result = await optimizePrompt({ itemId, original: value });
      if (result.success) setReview({ original: value, revision: result.data });
      else toast.error(result.error);
    } catch {
      toast.error("Unable to optimize the prompt. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function closeReview() {
    setReview(null);
    optimizeButton.current?.focus();
  }

  async function applyRevision() {
    if (!isPro || busy || !currentReview?.revision) return;
    setBusy("save");
    try {
      const result = await applyPromptRevision({ itemId, ...currentReview });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      closeReview();
      onSaved(result.data);
      router.refresh();
      toast.success("Prompt updated");
    } catch {
      toast.error("Unable to save the revised prompt. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return <>
    <MarkdownEditor value={value} readOnly headerAction={
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button ref={optimizeButton} type="button" variant="ghost" size="sm"
              className="h-8 shrink-0 hover:bg-zinc-800 hover:text-white"
              aria-disabled={!canOptimize} onClick={optimize}>
              {busy === "review" ? <Loader2 className="motion-safe:animate-spin" /> : isPro ? <Sparkles /> : <Crown />}
              Optimize
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="z-[60] rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow" sideOffset={4}>
              {isPro ? "Send the saved prompt to OpenAI for review" : "AI features require Pro subscription"}
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    } />
    <div role="status" className={currentReview?.revision === null ? "mt-3 text-sm text-muted-foreground" : "sr-only"}>
      {busy === "review" ? "Reviewing prompt" : currentReview?.revision === null ? "No revision suggested." : currentReview ? "Revised prompt available." : ""}
    </div>
    {currentReview?.revision && <section aria-labelledby={headingId} className="mt-3 space-y-3 rounded-lg border p-4">
      <h4 id={headingId} className="text-sm font-medium">Suggested revision</h4>
      <pre tabIndex={0} aria-label="Revised prompt" className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-sm [overflow-wrap:anywhere]">{currentReview.revision}</pre>
      <p className="text-sm text-muted-foreground">Use this revision to replace the saved prompt?</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!isPro || Boolean(busy)} onClick={applyRevision}>
          {busy === "save" ? "Saving…" : "Use revised prompt"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={Boolean(busy)} onClick={closeReview}>Keep original</Button>
      </div>
    </section>}
  </>;
}
