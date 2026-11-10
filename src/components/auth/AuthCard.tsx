import Link from "next/link";
import { DevStashMark } from "@/components/DevStashMark";

interface AuthCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="DevStash home" className="mb-8 flex items-center justify-center gap-3 text-xl font-semibold">
          <DevStashMark />
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
