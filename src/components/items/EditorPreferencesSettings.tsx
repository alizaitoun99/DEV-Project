"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { updateEditorPreferences } from "@/actions/editor-preferences";
import { EDITOR_THEMES, FONT_SIZES, TAB_SIZES, type EditorPreferences } from "@/lib/editor-preferences";
import { useEditorPreferences } from "./EditorPreferencesContext";

export function EditorPreferencesSettings() {
  const { preferences, setPreferences } = useEditorPreferences();
  const [pending, setPending] = useState(false);
  const saving = useRef(false);

  async function save(patch: Partial<EditorPreferences>) {
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    const previous = preferences;
    const next = { ...preferences, ...patch };
    setPreferences(next);
    try {
      const result = await updateEditorPreferences(next);
      if (!result.success) throw new Error(result.error);
      toast.success("Editor preferences saved");
    } catch {
      setPreferences(previous);
      toast.error("Unable to save editor preferences. Please try again.");
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  const selectClass = "mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring";
  return <section aria-labelledby="editor-preferences-title" className="space-y-4 rounded-xl border p-5 sm:p-6">
    <h2 id="editor-preferences-title" className="text-lg font-semibold">Editor preferences</h2>
    <p className="text-sm text-muted-foreground">Customize code editors for snippets and commands. Changes save automatically.</p>
    <fieldset disabled={pending} aria-busy={pending} className="grid gap-4 disabled:opacity-60 sm:grid-cols-2">
      <legend className="sr-only">Code editor preferences</legend>
      <label className="text-sm">Font size<select className={selectClass} value={preferences.fontSize} onChange={(event) => void save({ fontSize: FONT_SIZES.find((size) => size === Number(event.target.value)) ?? 13 })}>{FONT_SIZES.map((size) => <option key={size} value={size}>{size}px</option>)}</select></label>
      <label className="text-sm">Tab size<select className={selectClass} value={preferences.tabSize} onChange={(event) => void save({ tabSize: TAB_SIZES.find((size) => size === Number(event.target.value)) ?? 2 })}>{TAB_SIZES.map((size) => <option key={size} value={size}>{size} spaces</option>)}</select></label>
      <label className="text-sm sm:col-span-2">Theme<select className={selectClass} value={preferences.theme} onChange={(event) => void save({ theme: event.target.value as EditorPreferences["theme"] })}>{EDITOR_THEMES.map((theme) => <option key={theme} value={theme}>{theme}</option>)}</select></label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" role="switch" className="size-4 accent-primary" checked={preferences.wordWrap} onChange={(event) => void save({ wordWrap: event.target.checked })} />Word wrap</label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" role="switch" className="size-4 accent-primary" checked={preferences.minimap} onChange={(event) => void save({ minimap: event.target.checked })} />Minimap</label>
    </fieldset>
    <p role="status" className="text-xs text-muted-foreground">{pending ? "Saving…" : "Preferences apply to all your code editors."}</p>
  </section>;
}
