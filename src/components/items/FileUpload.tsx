"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { imageExtensions, uploadFormats, uploadIntentSchema } from "@/lib/upload-validation";

interface FileUploadProps {
  type: "file" | "image";
  file: File | null;
  onChange: (file: File | null) => void;
  disabled: boolean;
  progress: number | null;
}

export function FileUpload({ type, file, onChange, disabled, progress }: FileUploadProps) {
  const [error, setError] = useState("");
  const previewRef = useRef<HTMLImageElement>(null);
  const showPreview = file && ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type);
  useEffect(() => {
    if (!file || !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type)) return;
    const url = URL.createObjectURL(file);
    if (previewRef.current) previewRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function select(candidate: File | undefined) {
    if (disabled || !candidate) return;
    const parsed = uploadIntentSchema.safeParse({ type, fileName: candidate.name, size: candidate.size, mime: candidate.type });
    setError(parsed.success ? "" : parsed.error.issues.map((issue) => issue.message).join(" "));
    onChange(parsed.success ? candidate : null);
  }
  const extensions = Object.keys(uploadFormats).filter((extension) => imageExtensions.includes(extension) === (type === "image"));
  return <div className="space-y-3">
    <label className="block space-y-3 rounded-lg border border-dashed p-4 focus-within:ring-2 focus-within:ring-ring" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); select(event.dataTransfer.files[0]); }}>
      <span className="block text-sm font-medium">Choose or drop {type === "image" ? "an image" : "a file"}</span>
      <span className="block break-words text-xs text-muted-foreground">{extensions.map((extension) => `.${extension}`).join(", ")} · Maximum {type === "image" ? 5 : 10} MB</span>
      <input key={type} type="file" disabled={disabled} accept={extensions.map((extension) => `.${extension}`).join(",")} onChange={(event) => { select(event.target.files?.[0]); event.target.value = ""; }} className="block w-full min-w-0 text-sm file:mr-3 file:rounded file:border file:bg-muted file:px-3 file:py-2" />
    </label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {file && <p className="break-words text-sm">{file.name} · {file.size.toLocaleString()} bytes</p>}
    {showPreview && <Image ref={previewRef} unoptimized width={800} height={600} src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="Selected image preview" className="max-h-48 max-w-full rounded-md object-contain" />}
    {file?.name.toLowerCase().endsWith(".svg") && <p className="text-xs text-muted-foreground">SVG preview unavailable. The original can be downloaded after saving.</p>}
    {progress !== null && <div role="status" className="space-y-2 text-sm"><p>{progress < 100 ? `Uploading: ${progress}%` : "Validating and saving…"}</p><progress aria-label="Upload progress" value={progress} max={100} className="h-2 w-full" /></div>}
  </div>;
}

export async function uploadRequest(input: unknown) {
  const response = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Upload request failed. Please try again.");
  return result.data as { id: string; signedUrl?: string };
}

export function sendFile(url: string, file: File, mime: string, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = 120000;
    xhr.setRequestHeader("Content-Type", mime);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed. Check the file and try again."));
    xhr.onerror = () => reject(new Error("Connection lost during upload. Please try again."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Please try again."));
    xhr.send(file);
  });
}
