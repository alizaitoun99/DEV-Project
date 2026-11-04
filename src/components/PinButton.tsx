"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { Pin } from "lucide-react";
import { toast } from "sonner";
import { toggleItemPin } from "@/actions/pins";
import { Button } from "@/components/ui/button";

interface PinButtonProps {
  id: string;
  isPinned: boolean;
  onSaved: (value: boolean) => void;
}

export function PinButton({ id, isPinned, onSaved }: PinButtonProps) {
  const [pending, startTransition] = useTransition();
  const [optimisticPinned, setOptimisticPinned] = useOptimistic(isPinned);
  const saving = useRef(false);
  const label = optimisticPinned ? "Unpin item" : "Pin item";
  return <Button type="button" variant="ghost" aria-label={label} title={label} aria-pressed={optimisticPinned} aria-busy={pending} disabled={pending} onClick={() => {
    if (saving.current) return;
    saving.current = true;
    const next = !isPinned;
    startTransition(async () => {
      setOptimisticPinned(next);
      try {
        const result = await toggleItemPin({ id, isPinned: next });
        if (!result.success) { toast.error(result.error); return; }
        onSaved(next);
        toast.success(next ? "Item pinned" : "Item unpinned");
      } catch { toast.error("Unable to update pin. Please try again."); }
      finally { saving.current = false; }
    });
  }}><Pin aria-hidden="true" className={optimisticPinned ? "fill-current" : ""} />{optimisticPinned ? "Unpin" : "Pin"}</Button>;
}
