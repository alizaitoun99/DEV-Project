"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

type SidebarLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

export function SidebarLink({ href, className, ...props }: SidebarLinkProps) {
  const isCurrent = usePathname() === href;

  return (
    <Link
      {...props}
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className={`${className} aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-accent-foreground`}
    />
  );
}
