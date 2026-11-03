"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";

interface ImageThumbnailProps {
  id: string;
  title: string;
  mime: string | null;
}

export function ImageThumbnail({ id, title, mime }: ImageThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const canPreview = ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mime ?? "");

  return (
    <div className="relative aspect-video overflow-hidden bg-muted/40">
      {canPreview && !failed ? (
        <Image
          unoptimized
          fill
          src={`/api/items/${encodeURIComponent(id)}/download?preview=1`}
          alt={title}
          sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
          onError={() => setFailed(true)}
          className="object-cover transition-transform duration-300 group-hover:scale-105 group-focus-within:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
          <ImageOff aria-hidden="true" className="size-8" />
          <span>Preview unavailable</span>
        </div>
      )}
    </div>
  );
}
