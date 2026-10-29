"use client";

import Link from "next/link";
import { useState } from "react";
import { DropdownMenu } from "radix-ui";
import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserAvatar } from "@/components/auth/UserAvatar";

interface UserMenuProps {
  user: { name: string | null; email: string | null; image: string | null; plan: string };
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setPending(true);
    setError("");
    try {
      await signOut({ redirect: false });
      router.replace("/sign-in");
      router.refresh();
      toast.success("You’ve been signed out.");
    } catch {
      setError("Unable to sign out. Please try again.");
      toast.error("Unable to sign out. Please try again.");
    } finally {
      // Cached dashboard routes can restore this component after another sign-in.
      setPending(false);
    }
  }
  const itemClass = "flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm outline-none focus:bg-accent";
  return (
    <div className="shrink-0 border-t p-3">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger disabled={pending} aria-label="Open account menu" className="flex min-h-14 w-full items-center gap-3 rounded-lg p-1 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:opacity-50">
          <UserAvatar name={user.name} image={user.image} />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{user.name ?? "Your account"}</span><span className="block truncate text-xs text-muted-foreground">{user.email}</span></span>
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content side="top" align="start" sideOffset={8} className="z-[60] w-60 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl">
            <DropdownMenu.Label className="px-3 py-2 text-xs text-muted-foreground">{user.plan} plan</DropdownMenu.Label>
            <DropdownMenu.Item asChild><Link href="/profile" className={itemClass}><UserRound aria-hidden="true" className="size-4" />Profile</Link></DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item disabled={pending} onSelect={() => void logout()} className={itemClass}><LogOut aria-hidden="true" className="size-4" />{pending ? "Signing out…" : "Sign out"}</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
