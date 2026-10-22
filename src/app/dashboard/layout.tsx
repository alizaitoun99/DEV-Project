import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside
        aria-labelledby="sidebar-heading"
        className="border-b bg-sidebar p-6 md:w-64 md:shrink-0 md:border-r md:border-b-0"
      >
        <h2 id="sidebar-heading" className="text-lg font-semibold">
          Sidebar
        </h2>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader />
        <main className="flex-1 p-6 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
