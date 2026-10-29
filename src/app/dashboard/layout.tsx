import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { getCurrentUser } from "@/lib/current-user";
import { VerificationReminder } from "@/components/auth/VerificationReminder";
import { isEmailVerificationEnabled } from "@/lib/email-verification-config";

async function EmailVerificationReminder() {
  const user = await getCurrentUser();
  if (!isEmailVerificationEnabled()) return null;
  return <VerificationReminder verified={Boolean(user.emailVerified)} />;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <DashboardShell sidebar={
      <Suspense fallback={<div role="status" className="h-full animate-pulse bg-sidebar p-5 text-sm text-muted-foreground">Loading sidebar…</div>}>
        <DashboardSidebar />
      </Suspense>
    }><Suspense fallback={null}><EmailVerificationReminder /></Suspense>{children}</DashboardShell>
  );
}
