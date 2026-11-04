"use client";

import { useRef, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { setFavorite } from "@/actions/favorites";
import { Button } from "@/components/ui/button";

interface FavoriteButtonProps {
  kind: "item" | "collection";
  id: string;
  isFavorite: boolean;
  onSaved?: (value: boolean) => void;
}

export function FavoriteButton({ kind, id, isFavorite, onSaved }: FavoriteButtonProps) {
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);
  const label = isFavorite ? "Remove from favorites" : "Add to favorites";
  return <Button type="button" variant="ghost" size="icon" className="relative z-20 shrink-0" aria-label={label} title={label} aria-pressed={isFavorite} aria-busy={pending} disabled={pending} onClick={(event) => {
    event.stopPropagation();
    if (saving.current) return;
    saving.current = true;
    startTransition(async () => {
      try {
        const result = await setFavorite({ kind, id, isFavorite: !isFavorite });
        if (!result.success) { toast.error(result.error); return; }
        onSaved?.(!isFavorite);
        toast.success(isFavorite ? "Removed from favorites" : "Added to favorites");
      } catch { toast.error("Unable to update favorite. Please try again."); }
      finally { saving.current = false; }
    });
  }}><Star aria-hidden="true" className={isFavorite ? "fill-yellow-400 text-yellow-400" : ""} /></Button>;
}
