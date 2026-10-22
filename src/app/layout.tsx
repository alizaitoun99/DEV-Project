import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevStash",
  description: "Your developer knowledge hub.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
