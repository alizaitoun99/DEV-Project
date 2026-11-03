"use client";

import { Download, File, FileArchive, FileCode, FileImage, FileSpreadsheet, FileText } from "lucide-react";
import { ItemDrawerTrigger } from "@/components/items/ItemDrawerProvider";
import { Button } from "@/components/ui/button";

interface FileListRowProps {
  id: string;
  title: string;
  fileName: string | null;
  fileSize: string | null;
  createdAt: string;
}

const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function fileIcon(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (["zip", "gz", "tar", "7z", "rar"].includes(extension ?? "")) return <FileArchive aria-hidden="true" className="size-8 shrink-0 text-muted-foreground" />;
  if (["js", "ts", "tsx", "jsx", "json", "html", "css", "py", "sh", "xml", "yaml", "yml"].includes(extension ?? "")) return <FileCode aria-hidden="true" className="size-8 shrink-0 text-muted-foreground" />;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension ?? "")) return <FileImage aria-hidden="true" className="size-8 shrink-0 text-muted-foreground" />;
  if (["csv", "xls", "xlsx"].includes(extension ?? "")) return <FileSpreadsheet aria-hidden="true" className="size-8 shrink-0 text-muted-foreground" />;
  if (["pdf", "txt", "md", "doc", "docx", "rtf"].includes(extension ?? "")) return <FileText aria-hidden="true" className="size-8 shrink-0 text-muted-foreground" />;
  return <File aria-hidden="true" className="size-8 shrink-0 text-muted-foreground" />;
}

export function FileListRow({ id, title, fileName, fileSize, createdAt }: FileListRowProps) {
  const name = fileName || title;

  const size = fileSize === null ? null : Number(fileSize);
  const sizeLabel = size === null ? "Size unavailable" : size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <article className="@container relative flex min-w-0 items-center gap-3 rounded-xl border bg-card/20 p-4 hover:bg-muted/20 focus-within:bg-muted/20">
      <ItemDrawerTrigger id={id} title={title} />
      {fileIcon(name)}
      <div className="flex min-w-0 flex-1 flex-col gap-1 @min-[560px]:flex-row @min-[560px]:items-center @min-[560px]:gap-6">
        <p className="min-w-0 flex-1 break-words font-medium [overflow-wrap:anywhere]">{name}</p>
        <span className="shrink-0 text-sm text-muted-foreground @min-[560px]:w-24">{sizeLabel}</span>
        <time dateTime={createdAt} className="shrink-0 text-xs text-muted-foreground @min-[560px]:w-36">Uploaded {dateFormat.format(new Date(createdAt))}</time>
      </div>
      <Button variant="ghost" size="icon" asChild className="relative z-20 shrink-0">
        <a href={`/api/items/${encodeURIComponent(id)}/download`} download aria-label={`Download ${name}`} onClick={(event) => event.stopPropagation()}><Download aria-hidden="true" /></a>
      </Button>
    </article>
  );
}
