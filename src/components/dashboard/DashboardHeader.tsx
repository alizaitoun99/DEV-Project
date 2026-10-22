import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DashboardHeader() {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:flex-nowrap sm:px-6">
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
      <Button type="button" aria-disabled="true" className="h-11 shrink-0 sm:ml-auto">
        <Plus aria-hidden="true" />
        New Item
      </Button>
    </header>
  );
}
