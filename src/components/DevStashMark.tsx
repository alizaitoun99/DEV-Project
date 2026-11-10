import { Layers } from "lucide-react";

export function DevStashMark() {
  return (
    <span className="grid shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 p-2">
      <Layers aria-hidden="true" className="size-6 text-white" />
    </span>
  );
}
