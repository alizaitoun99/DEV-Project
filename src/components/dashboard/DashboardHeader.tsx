import { CreateItemDialog } from "@/components/items/CreateItemDialog";
import { CreateCollectionDialog } from "@/components/collections/CreateCollectionDialog";

interface DashboardHeaderProps {
  sidebarToggle: React.ReactNode;
  search: React.ReactNode;
}

export function DashboardHeader({ sidebarToggle, search }: DashboardHeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 lg:flex-nowrap sm:px-6">
      {sidebarToggle}
      <div className="relative min-w-0 flex-1 sm:max-w-lg">
        {search}
      </div>
      <div className="flex flex-wrap gap-3 sm:ml-auto">
        <CreateCollectionDialog />
        <CreateItemDialog />
      </div>
    </header>
  );
}
