import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorPreferencesLoader } from "@/components/items/EditorPreferencesLoader";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevStash",
  description: "Your developer knowledge hub.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="min-h-dvh bg-background font-sans text-foreground antialiased"
        suppressHydrationWarning
      >
        <Suspense fallback={<p role="status" className="p-6">Loading workspace…</p>}>
          <EditorPreferencesLoader>{children}</EditorPreferencesLoader>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
