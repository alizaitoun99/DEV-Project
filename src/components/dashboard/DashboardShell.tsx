"use client";

import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { PanelLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

interface DashboardShellProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  search: React.ReactNode;
}

export function DashboardShell({ children, sidebar, search }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const closeMobile = () => { if (media.matches) setMobileOpen(false); };
    media.addEventListener("change", closeMobile);
    return () => media.removeEventListener("change", closeMobile);
  }, []);

  return (
    <div className="flex min-h-dvh">
      <aside id="desktop-sidebar" aria-label="Sidebar" hidden={collapsed} className="sticky top-0 hidden h-dvh w-72 shrink-0 border-r md:not-[hidden]:block">
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader search={search} sidebarToggle={
          <>
            <Button variant="ghost" size="icon" className="hidden size-11 md:inline-flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="desktop-sidebar" onClick={() => setCollapsed(!collapsed)}>
              <PanelLeft aria-hidden="true" />
            </Button>
            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
              <Dialog.Trigger asChild>
                <Button variant="ghost" size="icon" className="size-11 md:hidden" aria-label="Open sidebar">
                  <PanelLeft aria-hidden="true" />
                </Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
                <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 w-72 max-w-[calc(100vw-2rem)] border-r outline-none">
                  <Dialog.Title className="sr-only">Dashboard sidebar</Dialog.Title>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon" aria-label="Close sidebar" className="absolute top-4 right-3">
                      <X aria-hidden="true" />
                    </Button>
                  </Dialog.Close>
                  <div className="h-full" onClick={(event) => {
                    if (event.target instanceof Element && event.target.closest("a")) setMobileOpen(false);
                  }}>{sidebar}</div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </>
        } />
        <main className="flex-1 p-6 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
