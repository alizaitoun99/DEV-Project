import { CreateItemDialog } from "@/components/items/CreateItemDialog";
import { CreateCollectionDialog } from "@/components/collections/CreateCollectionDialog";
import Link from "next/link";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <Button asChild variant="ghost" size="icon" className="size-11">
          <Link href="/favorites" aria-label="Favorites"><Star aria-hidden="true" /></Link>
        </Button>
        <CreateCollectionDialog />
        <CreateItemDialog />
      </div>
    </header>
  );
}
