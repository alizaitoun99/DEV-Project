"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";

interface CollectionOption { id: string; name: string; }
interface CollectionSelectorProps {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function CollectionSelector({ value, onChange, disabled }: CollectionSelectorProps) {
  const hintId = useId();
  const [options, setOptions] = useState<CollectionOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/collections", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Unable to load collections.");
        setOptions(result.data);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load collections.");
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);
  return <fieldset disabled={disabled} className="min-w-0 space-y-2" aria-describedby={hintId}>
    <legend className="text-sm font-medium">Collections</legend>
    <p id={hintId} className="text-xs text-muted-foreground">Select one or more collections, or leave all unchecked.</p>
    {error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button type="button" variant="outline" onClick={() => { setError(null); setAttempt((current) => current + 1); }}>Retry</Button></div> : options === null ? <p role="status" className="text-sm text-muted-foreground">Loading collections…</p> : options.length === 0 ? <p className="text-sm text-muted-foreground">No collections available yet.</p> : <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-input p-2">
      {options.map((option) => <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded px-2 py-2 text-sm hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
        <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={value.includes(option.id)} onChange={(event) => onChange(event.target.checked ? [...value, option.id] : value.filter((id) => id !== option.id))} />
        <span className="min-w-0 break-words">{option.name}</span>
      </label>)}
    </div>}
  </fieldset>;
}
