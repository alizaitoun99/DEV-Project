"use client";

import { Avatar } from "radix-ui";

interface UserAvatarProps {
  name: string | null;
  image?: string | null;
}

export function UserAvatar({ name, image }: UserAvatarProps) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2) ?? "U").toUpperCase();
  return (
    <Avatar.Root className="flex size-10 shrink-0 overflow-hidden rounded-full bg-violet-500/20 text-sm font-semibold text-violet-300">
      {image && <Avatar.Image src={image} alt={name ?? "User"} className="size-full object-cover" referrerPolicy="no-referrer" />}
      <Avatar.Fallback className="flex size-full items-center justify-center" aria-label={name ?? "User"}>{initials}</Avatar.Fallback>
    </Avatar.Root>
  );
}
