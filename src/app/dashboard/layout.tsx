import { Suspense } from "react";
import { ItemDrawerProvider } from "@/components/items/ItemDrawerProvider";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { getCurrentUser } from "@/lib/current-user";
import { VerificationReminder } from "@/components/auth/VerificationReminder";
import { isEmailVerificationEnabled } from "@/lib/email-verification-config";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import Link from "next/link";
import { Button } from "@/components/ui/button";

async function EmailVerificationReminder() {
  const user = await getCurrentUser();
  if (!isEmailVerificationEnabled()) return null;
  return <VerificationReminder verified={Boolean(user.emailVerified)} />;
}

async function UpgradeLink() {
  const user = await getCurrentUser();
  if (user.plan !== "FREE") return null;

  return (
    <Button asChild variant="ghost" className="min-h-11 text-muted-foreground">
      <Link href="/upgrade">Upgrade</Link>
    </Button>
  );
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ItemDrawerProvider><DashboardShell upgrade={<Suspense fallback={null}><UpgradeLink /></Suspense>} search={<Suspense fallback={<button disabled className="h-11 w-full rounded-md bg-muted/50 px-3 text-left text-sm text-muted-foreground">Loading search…</button>}><GlobalSearch /></Suspense>} sidebar={
      <Suspense fallback={<div role="status" className="h-full animate-pulse bg-sidebar p-5 text-sm text-muted-foreground">Loading sidebar…</div>}>
        <DashboardSidebar />
      </Suspense>
    }><Suspense fallback={null}><EmailVerificationReminder /></Suspense>{children}</DashboardShell></ItemDrawerProvider>
  );
}
