import Link from "next/link";
import { Layers } from "lucide-react";

interface AuthCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/sign-in" className="mb-8 flex items-center justify-center gap-3 text-xl font-semibold">
          <span className="rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 p-2"><Layers aria-hidden="true" className="size-6 text-white" /></span>
          DevStash
        </Link>
        <section className="rounded-2xl border bg-card p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">{description}</p>
          {children}
        </section>
      </div>
    </main>
  );
}
