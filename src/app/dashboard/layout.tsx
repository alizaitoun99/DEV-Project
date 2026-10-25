import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <DashboardShell sidebar={
      <Suspense fallback={<div role="status" className="h-full animate-pulse bg-sidebar p-5 text-sm text-muted-foreground">Loading sidebar…</div>}>
        <DashboardSidebar />
      </Suspense>
    }>{children}</DashboardShell>
  );
}
