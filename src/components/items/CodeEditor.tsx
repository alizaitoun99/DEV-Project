"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { BeforeMount, OnMount } from "@monaco-editor/react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEditorPreferences } from "./EditorPreferencesContext";

const registerThemes: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("monokai", {
    base: "vs-dark", inherit: true,
    rules: [
      { token: "comment", foreground: "88846F", fontStyle: "italic" },
      { token: "keyword", foreground: "F92672" },
      { token: "string", foreground: "E6DB74" },
      { token: "number", foreground: "AE81FF" },
      { token: "type", foreground: "66D9EF" },
    ],
    colors: { "editor.background": "#272822", "editor.foreground": "#F8F8F2", "editorCursor.foreground": "#F8F8F0", "editor.selectionBackground": "#49483E" },
  });
  monaco.editor.defineTheme("github-dark", {
    base: "vs-dark", inherit: true,
    rules: [
      { token: "comment", foreground: "8B949E" },
      { token: "keyword", foreground: "FF7B72" },
      { token: "string", foreground: "A5D6FF" },
      { token: "number", foreground: "79C0FF" },
      { token: "type", foreground: "FFA657" },
    ],
    colors: { "editor.background": "#0D1117", "editor.foreground": "#C9D1D9", "editorCursor.foreground": "#C9D1D9", "editor.selectionBackground": "#264F78" },
  });
};

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface CodeEditorProps {
  value: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

export function CodeEditor({ value, language = "", readOnly = false, onChange }: CodeEditorProps) {
  const { preferences } = useEditorPreferences();
  const subscription = useRef<{ dispose: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(120);
  const normalized = language.trim().toLowerCase();
  const aliases: Record<string, string> = { js: "javascript", ts: "typescript", sh: "shell", bash: "shell", py: "python", "c#": "csharp", "c++": "cpp" };

  useEffect(() => () => subscription.current?.dispose(), []);

  const mount: OnMount = (editor) => {
    const resize = () => {
      setHeight(Math.min(352, Math.max(120, editor.getContentHeight())));
    };
    subscription.current?.dispose();
    subscription.current = editor.onDidContentSizeChange(resize);
    resize();
    setReady(true);
  };

  async function copy() {
    try { await navigator.clipboard.writeText(value); toast.success("Copied to clipboard"); }
    catch { toast.error("Unable to copy. Please try again."); }
  }

  return <div className="min-w-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100">
    <div className="flex h-11 items-center gap-3 border-b border-zinc-700 px-3">
      <div aria-hidden="true" className="flex shrink-0 gap-1.5"><span className="size-3 rounded-full bg-red-400" /><span className="size-3 rounded-full bg-yellow-400" /><span className="size-3 rounded-full bg-green-400" /></div>
      <span className="ml-auto truncate text-xs text-zinc-400">{language.trim() || "Plain text"}</span>
      <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 hover:bg-zinc-800 hover:text-white" aria-label="Copy code" disabled={!value} onClick={copy}><Copy className="size-4" /></Button>
    </div>
    {!ready && <textarea aria-label="Code content" value={value} readOnly={readOnly} onChange={(event) => onChange?.(event.target.value)} className="block h-32 w-full resize-none bg-zinc-900 p-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />}
    <div className={ready ? "" : "h-0 overflow-hidden"}>
      <MonacoEditor height={height} value={value} language={aliases[normalized] ?? (normalized || "plaintext")} theme={preferences.theme} beforeMount={registerThemes} onMount={mount} onChange={(content) => onChange?.(content ?? "")} loading={<span className="sr-only">Loading code editor</span>} options={{
        readOnly, domReadOnly: readOnly, ariaLabel: "Code content", automaticLayout: true,
        minimap: { enabled: preferences.minimap }, scrollBeyondLastLine: false, fontSize: preferences.fontSize,
        lineNumbersMinChars: 3, folding: false, wordWrap: preferences.wordWrap ? "on" : "off", tabSize: preferences.tabSize,
        tabFocusMode: true, padding: { top: 12, bottom: 12 },
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, alwaysConsumeMouseWheel: false },
      }} />
    </div>
  </div>;
}
