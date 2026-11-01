import { Search } from "lucide-react";

import { CreateItemDialog } from "@/components/items/CreateItemDialog";
import { Input } from "@/components/ui/input";

interface DashboardHeaderProps {
  sidebarToggle: React.ReactNode;
}

export function DashboardHeader({ sidebarToggle }: DashboardHeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:flex-nowrap sm:px-6">
      {sidebarToggle}
      <div className="relative min-w-0 flex-1 sm:max-w-lg">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search items"
          placeholder="Search items..."
          className="h-11 border-transparent bg-muted/50 pl-10 shadow-none"
          readOnly
        />
      </div>
      <CreateItemDialog />
    </header>
  );
}
