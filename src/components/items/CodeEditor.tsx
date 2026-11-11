"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { BeforeMount, OnMount } from "@monaco-editor/react";
import { Copy, Crown, Loader2, Sparkles } from "lucide-react";
import { Tabs, Tooltip } from "radix-ui";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { explainCode } from "@/actions/ai";
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
  explain?: { itemId: string; isPro: boolean };
}

const controlClass = "h-8 shrink-0 hover:bg-zinc-800 hover:text-white";
const tabClass = "rounded px-2 py-1 text-xs text-zinc-400 data-[state=active]:bg-zinc-700 data-[state=active]:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CodeEditor({ value, language = "", readOnly = false, onChange, explain }: CodeEditorProps) {
  const { preferences } = useEditorPreferences();
  const subscription = useRef<{ dispose: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(120);
  const [tab, setTab] = useState("code");
  const [explanation, setExplanation] = useState("");
  const [explaining, setExplaining] = useState(false);
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
    try { await navigator.clipboard.writeText(tab === "explain" ? explanation : value); toast.success("Copied to clipboard"); }
    catch { toast.error("Unable to copy. Please try again."); }
  }

  async function generateExplanation() {
    if (!explain?.isPro || explaining || !value.trim()) return;
    setExplaining(true);
    try {
      const result = await explainCode(explain.itemId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setExplanation(result.data);
      setTab("explain");
    } catch {
      toast.error("Unable to explain code right now. Please try again.");
    } finally {
      setExplaining(false);
    }
  }

  const editor = <>
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
  </>;

  return <Tabs.Root value={tab} onValueChange={setTab} className="min-w-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100">
    <div className="flex h-11 items-center gap-1 border-b border-zinc-700 px-3">
      {explanation ? <Tabs.List aria-label="Code editor view" className="flex shrink-0 gap-1">
        <Tabs.Trigger value="code" className={tabClass}>Code</Tabs.Trigger>
        <Tabs.Trigger value="explain" className={tabClass}>Explain</Tabs.Trigger>
      </Tabs.List> : <div aria-hidden="true" className="flex shrink-0 gap-1.5"><span className="size-3 rounded-full bg-red-400" /><span className="size-3 rounded-full bg-yellow-400" /><span className="size-3 rounded-full bg-green-400" /></div>}
      <span className="ml-auto truncate text-xs text-zinc-400">{language.trim() || "Plain text"}</span>
      <Button type="button" variant="ghost" size="icon" className={controlClass} aria-label={tab === "explain" ? "Copy explanation" : "Copy code"} disabled={!value} onClick={copy}><Copy className="size-4" /></Button>
      {explain && <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button type="button" variant="ghost" size="sm" className={controlClass} aria-label="Explain code" aria-disabled={!explain.isPro || explaining || !value.trim()} onClick={generateExplanation}>
              {explaining ? <Loader2 className="size-4 motion-safe:animate-spin" /> : explain.isPro ? <Sparkles className="size-4" /> : <Crown className="size-4" />}
              Explain
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="z-[60] rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow" sideOffset={4}>
              {explain.isPro ? "Send saved code to OpenAI for an explanation" : "AI features require Pro subscription"}
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>}
      <span role="status" className="sr-only">{explaining ? "Generating explanation" : explanation ? "Explanation available" : ""}</span>
    </div>
    <Tabs.Content value="code" forceMount {...(!explanation && { role: "presentation", "aria-labelledby": undefined, tabIndex: -1 })} className="data-[state=inactive]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      {editor}
    </Tabs.Content>
    {explanation && <Tabs.Content value="explain" className="markdown-preview max-h-[352px] min-h-32 overflow-auto p-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      <Markdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={["img", "a"]} unwrapDisallowed>{explanation}</Markdown>
    </Tabs.Content>}
  </Tabs.Root>;
}
