import {
  ArrowRight, ArrowUpRight, Check, Code2, Command, FileText, LayoutGrid,
  Play, Search, Sparkles, Terminal, UserRound,
} from "lucide-react";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { DevStashMark } from "@/components/DevStashMark";
import { ChaosPanel } from "@/components/homepage/ChaosPanel";
import { DashboardPreview } from "@/components/homepage/DashboardPreview";
import { PricingComparison } from "@/components/homepage/PricingComparison";
import { RestoreSectionScroll } from "@/components/homepage/RestoreSectionScroll";
import { Button } from "@/components/ui/button";
import { findCurrentUser } from "@/lib/current-user";
import styles from "./homepage.module.css";

const sections = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#ai", label: "AI powers" },
];

const features = [
  { name: "Code snippets", title: "Good code deserves a home.", icon: Code2, accent: "bg-blue-500/15 text-blue-300", description: "Save the snippets you keep rewriting, with syntax highlighting for the languages you use." },
  { name: "AI prompts", title: "Your best prompts, on repeat.", icon: Sparkles, accent: "bg-amber-500/15 text-amber-300", description: "Keep the prompts that actually work so you can reuse them in your next conversation." },
  { name: "Instant search", title: "Find it before you forget it.", icon: Search, accent: "bg-indigo-500/15 text-indigo-300", description: "Search across your stash from one command palette. Open it with Cmd or Ctrl + K." },
  { name: "Commands", title: "That command. Right there.", icon: Terminal, accent: "bg-cyan-500/15 text-cyan-300", description: "Keep Git commands, Docker one-liners, and terminal shortcuts ready when you need them." },
  { name: "Files & docs", title: "Keep the whole picture.", icon: FileText, accent: "bg-slate-500/20 text-slate-300", description: "Save diagrams, images, and reference files alongside your code." },
  { name: "Collections", title: "A little order goes a long way.", icon: LayoutGrid, accent: "bg-green-500/15 text-green-300", description: "Group your knowledge into collections by project, topic, or however you work." },
];

const itemTypes = [
  ["Snippets", "text-blue-300"], ["Prompts", "text-amber-300"], ["Commands", "text-cyan-300"],
  ["Notes", "text-green-300"], ["Files", "text-slate-300"], ["Images", "text-pink-300"],
  ["Links", "text-indigo-300"],
];

const aiActions = [
  "Suggest tags for saved items",
  "Turn long notes into summaries",
  "Explain unfamiliar code",
  "Refine prompts for reuse",
];

const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";
const eyebrow = "font-mono text-xs font-semibold tracking-[0.16em] text-blue-300";
const sectionTitle = "mt-3 text-4xl font-bold tracking-tight sm:text-5xl";
const primary = "bg-[#3b82f6] font-bold text-[#080e1b] hover:bg-blue-400";

function Brand() {
  return (
    <Link href="/" aria-label="DevStash home" className="inline-flex w-fit items-center gap-2 rounded text-lg font-bold tracking-tight">
      <DevStashMark />
      <span>DevStash</span>
    </Link>
  );
}

async function AccountLinks({ footer = false }: { footer?: boolean }) {
  const user = await findCurrentUser();
  if (footer) {
    return user ? (
      <>
        <Link href="/dashboard" className="rounded hover:text-blue-200">Dashboard</Link>
        <Link href="/profile" className="rounded hover:text-blue-200">My Profile</Link>
      </>
    ) : (
      <>
        <Link href="/register" className="rounded hover:text-blue-200">Get started</Link>
        <a href="/sign-in" className="rounded hover:text-blue-200">Sign in</a>
      </>
    );
  }

  return user ? (
    <>
      <Button asChild className={primary}><Link href="/dashboard">Dashboard</Link></Button>
      <Button asChild variant="outline" size="icon">
        <Link href="/profile" aria-label="My Profile" title="My Profile"><UserRound aria-hidden="true" /></Link>
      </Button>
    </>
  ) : (
    <>
      <a href="/sign-in" className="inline-flex items-center gap-1 rounded text-sm whitespace-nowrap text-slate-200 hover:text-blue-200">Sign in <ArrowUpRight aria-hidden="true" className="hidden size-3 lg:block" /></a>
      <Button asChild className={primary}><Link href="/register">Get started <ArrowRight aria-hidden="true" className="hidden sm:block" /></Link></Button>
    </>
  );
}

async function WorkspaceButton({ label, className, variant }: {
  label: string;
  className: string;
  variant?: "default" | "outline";
}) {
  const user = await findCurrentUser();
  return (
    <Button asChild className={className} variant={variant}>
      <Link href={user ? "/dashboard" : "/register"}>
        {user ? "Open dashboard" : label} <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  );
}

async function Pricing() {
  const user = await findCurrentUser();
  return <PricingComparison signedIn={Boolean(user)}
    freeAction={<WorkspaceButton className="h-10 w-full" variant="outline" label="Start your stash" />}
  />;
}

async function Copyright() {
  "use cache";
  cacheLife("days");

  return <p>© {new Date().getFullYear()} DevStash. Keep the good stuff.</p>;
}

function Hero() {
  return (
    <section className={`${container} pt-15 pb-13 text-center sm:pt-22`} aria-labelledby="homepage-title">
      <div className={styles.heroIntro}>
        <p className={eyebrow}>YOUR SECOND BRAIN, BUILT FOR CODE</p>
        <h1 id="homepage-title" className="mt-5 text-[clamp(2.5rem,7vw,5rem)] leading-[1.02] font-bold tracking-tight">
          Stop losing your<br className="hidden sm:block" />{" "}
          <span className="bg-gradient-to-r from-blue-200 via-blue-400 to-indigo-300 bg-clip-text text-transparent">developer knowledge.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
          That snippet. That prompt. That command you always forget. Give everything you know a place to call home.
        </p>
      </div>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Suspense fallback={<span className="h-11 w-40" aria-hidden="true" />}>
          <WorkspaceButton className={`h-11 px-4 ${primary}`} label="Start your stash" />
        </Suspense>
        <Button asChild variant="outline" className="h-11 px-4"><a href="#preview"><Play aria-hidden="true" /> See how it works</a></Button>
      </div>
      <p className="mt-3 text-xs text-slate-400">No credit card required</p>
      <section id="preview" aria-label="Workspace preview" className="mt-12 grid scroll-mt-32 items-start gap-4 text-left sm:scroll-mt-24 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.3fr)]">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Your knowledge today...</h2>
          <ChaosPanel />
          <p className="mt-2 text-xs text-slate-400">8 different places. Zero peace of mind.</p>
        </div>
        <div aria-hidden="true" className="flex flex-col items-center gap-2 self-center px-2 text-blue-300">
          <span className="grid size-10 place-items-center rounded-full border border-blue-400/25 bg-blue-500/10 motion-safe:animate-pulse">
            <ArrowRight className="size-5 rotate-90 lg:rotate-0" />
          </span>
          <span className="font-mono text-[9px] tracking-widest">ONE HOME</span>
        </div>
        <div className="min-w-0">
          <h2 className="mb-2 flex justify-between gap-2 text-sm font-semibold text-blue-200">...with DevStash <span className="font-mono text-[10px] tracking-wide text-blue-300">SAMPLE WORKSPACE</span></h2>
          <DashboardPreview />
          <p className="mt-2 text-xs text-blue-200">Less searching. More building.</p>
        </div>
      </section>
      <div className="mt-10 border-t border-white/10 pt-6">
        <p className="font-mono text-xs tracking-widest text-slate-400">MADE FOR THE WAY YOU THINK</p>
        <ul className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
          {itemTypes.map(([name, color]) => <li key={name} className={color}>{name}</li>)}
        </ul>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="scroll-mt-24 border-y border-white/10 bg-[#10121d] py-16 sm:scroll-mt-17 sm:py-24">
      <div className={container}>
        <div className="text-center">
          <p className={eyebrow}>A PLACE FOR EVERY “I’LL NEED THIS LATER”</p>
          <h2 className={sectionTitle}>Everything worth keeping.<br /><span className="text-blue-300">Finally, kept together.</span></h2>
          <p className="mt-4 text-slate-300">Less tab archaeology. More time to build.</p>
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ name, title, icon: Icon, accent, description }) => (
            <article key={name} className={`${styles.reveal} flex flex-col items-start rounded-2xl border border-white/10 bg-[#151827] p-6`}>
              <span className={`grid size-10 place-items-center rounded-lg ${accent}`}><Icon aria-hidden="true" className="size-5" /></span>
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 mb-5 flex-1 text-sm leading-relaxed text-slate-300">{description}</p>
              <p className={`rounded px-2 py-1 font-mono text-[10px] tracking-wider uppercase ${accent}`}>{name}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AiPreview() {
  return (
    <section id="ai" className={`${container} grid scroll-mt-24 items-center gap-8 py-16 sm:scroll-mt-17 sm:py-24 lg:grid-cols-2`}>
      <div>
        <p className={eyebrow}>PLANNED PRO FEATURE</p>
        <h2 className={sectionTitle}>Your stash.<br /><span className="text-blue-300">A little smarter.</span></h2>
        <p className="mt-4 max-w-md text-slate-300">A preview of how AI could help you organize and reuse what you save.</p>
        <ul className="mt-5 space-y-3 text-sm text-slate-300">
          {aiActions.map((action) => <li key={action} className="flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-blue-300" />{action}</li>)}
        </ul>
        <a href="#pricing" className="mt-6 inline-flex items-center gap-2 rounded font-semibold text-blue-300 hover:underline">See the plan comparison <ArrowRight aria-hidden="true" className="size-4" /></a>
      </div>
      <div className={`${styles.reveal} min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#11131e]`}>
        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#171a28] px-4 py-3 font-mono text-xs text-slate-300">
          <span className="flex items-center gap-2"><Code2 aria-hidden="true" className="size-4 text-blue-300" /> useDebounce.ts</span><span>TypeScript</span>
        </div>
        <pre className="px-4 py-5 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-slate-200 sm:px-6 sm:text-sm"><code>
          <span className="text-violet-300">export function</span>{" "}<span className="text-blue-300">useDebounce</span>{`<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}`}
        </code></pre>
        <div className="border-t border-blue-400/20 bg-blue-500/10 px-4 py-4 sm:px-6">
          <p className="flex items-center gap-2 text-sm font-bold text-blue-200"><Sparkles aria-hidden="true" className="size-4" /> AI Generated Tags <span className="ml-auto text-xs font-normal text-slate-300">Example</span></p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {["react", "hooks", "performance", "typescript"].map((tag) => <li key={tag} className="rounded-full bg-blue-400/15 px-2 py-1 font-mono text-xs text-blue-200">{tag}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh bg-[#090a10] pt-24 text-[#f3f5ff] sm:pt-17 [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-blue-300">
      <RestoreSectionScroll />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-[#111827] focus:p-3">Skip to content</a>
      <header className={`${styles.navbar} fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#090a10]/95 backdrop-blur-md`}>
        <nav aria-label="Main navigation" className={`${container} grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-2 py-3 sm:flex sm:justify-between sm:gap-4`}>
          <Brand />
          <div className="order-last col-span-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-slate-300 sm:order-0">
            {sections.map(({ href, label }) => <a key={href} href={href} className="rounded hover:text-blue-200">{label}</a>)}
          </div>
          <div className="flex items-center gap-3">
            <Suspense fallback={<span className="h-9 w-36" aria-hidden="true" />}>
              <AccountLinks />
            </Suspense>
          </div>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="scroll-mt-24 bg-[radial-gradient(ellipse_65%_28rem_at_50%_0%,#142346,transparent)] sm:scroll-mt-17">
        <Hero />
        <Features />
        <AiPreview />
        <section id="pricing" className={`${container} scroll-mt-24 pb-16 sm:scroll-mt-17 sm:pb-24`}>
          <div className="text-center">
            <p className={eyebrow}>PRICING</p>
            <h2 className={sectionTitle}>Invest in your <span className="text-blue-300">future self.</span></h2>
            <p className="mt-4 text-slate-300">Compare Free and Pro for your developer stash.</p>
          </div>
          <Suspense fallback={<p className="mt-7 text-center text-slate-300">Loading plans…</p>}><Pricing /></Suspense>
        </section>
        <section className={`${container} pb-16 sm:pb-24`}>
          <div className={`${styles.reveal} rounded-3xl border border-blue-400/25 bg-[radial-gradient(ellipse_at_top,#1b315e,#10121d_75%)] px-4 py-12 text-center sm:py-16`}>
            <Command aria-hidden="true" className="mx-auto mb-5 size-8 text-blue-300" />
            <p className={eyebrow}>LESS LOST. MORE BUILT.</p>
            <h2 className={sectionTitle}>Ready to organize<br />your knowledge?</h2>
            <p className="mt-4 text-slate-300">Your next great idea deserves a better home than an open tab.</p>
            <Suspense fallback={<div className="mt-6 h-11" />}>
              <WorkspaceButton className={`mt-6 h-11 px-4 ${primary}`} label="Make room for what you know" />
            </Suspense>
          </div>
        </section>
      </main>
      <footer className={`${container} border-t border-white/10 pt-8 pb-6 text-sm text-slate-400`}>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-[2fr_1fr_1fr]">
          <div className="col-span-2 sm:col-span-1"><div className="text-white"><Brand /></div><p className="mt-3">A home for everything you know.<br />And everything you’re about to learn.</p></div>
          <div className="flex flex-col items-start gap-2">
            <p className="mb-1 font-bold text-slate-200">Product</p>
            {sections.map(({ href, label }) => <a key={href} href={href} className="rounded hover:text-blue-200">{label}</a>)}
          </div>
          <div className="flex flex-col items-start gap-2">
            <p className="mb-1 font-bold text-slate-200">Your workspace</p>
            <Suspense fallback={<div className="h-12" />}>
              <AccountLinks footer />
            </Suspense>
            <a href="#preview" className="rounded hover:text-blue-200">Take a look</a>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap justify-between gap-2 border-t border-white/10 pt-4 text-xs">
          <Copyright />
          <p>Made for developers, by developers.</p>
        </div>
      </footer>
    </div>
  );
}
