import { Code2, Command, LayoutGrid, Link2, Pin, Search, Sparkles, StickyNote, Terminal } from "lucide-react";

const library = [
  { label: "Snippets", icon: Code2, count: 24, color: "text-[#3b82f6]" },
  { label: "Prompts", icon: Sparkles, count: 12, color: "text-[#f59e0b]" },
  { label: "Commands", icon: Terminal, count: 8, color: "text-[#06b6d4]" },
  { label: "Notes", icon: StickyNote, count: 16, color: "text-[#22c55e]" },
  { label: "Links", icon: Link2, count: 9, color: "text-[#818cf8]" },
];

const recent = [
  { type: "Snippet", title: "useLocalStorage hook", sample: "useLocalStorage(key)", accent: "border-t-[#3b82f6] text-blue-300" },
  { type: "Prompt", title: "My code review copilot", sample: "Review for clarity and edge cases.", accent: "border-t-[#f59e0b] text-amber-300" },
  { type: "Command", title: "Undo the last commit", sample: "git reset --soft HEAD~1", accent: "border-t-[#06b6d4] text-cyan-300" },
  { type: "Note", title: "Things I learned today", sample: "Small discoveries to keep.", accent: "border-t-[#22c55e] text-green-300" },
];

export function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-blue-400/25 bg-[#10121d] shadow-[0_0_48px_#3b82f61a] lg:min-h-87">
      <div aria-hidden="true" className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#171a28] px-3 py-2.5 font-mono text-[10px] text-slate-400">
        <span className="text-blue-400">● ● ●</span> <span>your workspace, organized</span> <span>↗</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[8.5rem_minmax(0,1fr)]">
        <div className="border-b border-white/10 bg-[#0d101a] p-3 text-[11px] text-slate-300 sm:border-r sm:border-b-0">
          <p className="mb-3 flex items-center gap-1 font-bold text-white"><Command aria-hidden="true" className="size-3 text-blue-400" /> devstash.</p>
          <p className="hidden items-center gap-2 rounded bg-blue-500/15 px-1.5 py-1 text-blue-200 sm:flex"><LayoutGrid aria-hidden="true" className="size-3" /> Overview</p>
          <p className="hidden items-center gap-2 px-1.5 py-1 sm:flex"><Search aria-hidden="true" className="size-3" /> Search</p>
          <p className="mb-1 font-mono text-[10px] tracking-widest text-slate-400 uppercase sm:mt-3">Library</p>
          <ul className="flex flex-wrap gap-x-2 gap-y-1 sm:block">
            {library.map(({ label, icon: Icon, count, color }) => (
              <li key={label} className="flex items-center gap-1.5 sm:py-1">
                <Icon aria-hidden="true" className={`size-3 shrink-0 ${color}`} />{label}
                <span className="ml-auto hidden text-slate-400 sm:inline">{count}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 hidden border-t border-white/10 pt-2 text-[10px] sm:block">Jamie’s workspace</p>
        </div>
        <div className="min-w-0 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold">Your knowledge, together.</h3>
              <p className="text-[10px] text-slate-400">A little more organized. A lot more you.</p>
            </div>
            <span className="shrink-0 rounded bg-blue-500/20 px-2 py-1 text-[10px] text-blue-200">+ New</span>
          </div>
          <h4 className="mt-3 text-[11px] font-semibold">Pinned</h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-blue-400/25 bg-blue-500/10 px-2 py-1.5 text-[10px]">
            <Pin aria-hidden="true" className="size-3 text-blue-300" />
            <strong>Generate a unique ID</strong>
            <code className="text-blue-200">crypto.randomUUID()</code>
          </div>
          <h4 className="mt-3 text-[11px] font-semibold">Recently saved</h4>
          <ul className="mt-1 grid grid-cols-2 gap-2">
            {recent.map(({ type, title, sample, accent }) => (
              <li key={type} className={`min-w-0 rounded-md border border-t-2 border-white/10 bg-[#171a28] p-2 ${accent}`}>
                <p className="font-mono text-[9px] uppercase">{type}</p>
                <p className="mt-1 text-[11px] font-semibold text-white">{title}</p>
                <p className="mt-1 break-words font-mono text-[9px] text-slate-400">{sample}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
