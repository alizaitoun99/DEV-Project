import "server-only";
import { getSupabaseStorage } from "@/lib/supabase-storage";
import { abandonUploadRecord, cleanupStorageRecords, createUploadRecord, finalizeUploadRecord, getItemCleanupRecord } from "@/lib/db/items";
import { UploadError, uploadFormats, uploadIntentSchema, type UploadIntent } from "@/lib/upload-validation";
import { verifyUploadContent } from "@/lib/upload-content";
import { itemUpdateSchema } from "@/lib/item-validation";
import { consumeAuthLimit } from "@/lib/auth-rate-limit";
import type { StorageObject } from "@/generated/prisma/client";

export { UploadError } from "@/lib/upload-validation";

export async function beginUpload(userId: string, input: unknown) {
  const parsed = uploadIntentSchema.parse(input);
  await consumeAuthLimit(`storage:upload:${userId}`, 30, 3600);
  const { client, bucket } = getSupabaseStorage();
  const info = await client.getBucket(bucket);
  if (info.error || !info.data || info.data.public || Number(info.data.file_size_limit) !== 10 * 1024 * 1024 ||
      !info.data.allowed_mime_types?.length || info.data.allowed_mime_types.some((mime) => !Object.values(uploadFormats).flat().includes(mime))) {
    throw new UploadError("Storage bucket must be private with a 10 MB limit and the supported MIME allowlist. Contact the administrator.");
  }
  const record = await createUploadRecord(userId, bucket, parsed);
  const result = await client.from(bucket).createSignedUploadUrl(record.key, { upsert: false });
  if (result.error) {
    await abandonUploadRecord(userId, record.id);
    throw new UploadError("Unable to prepare upload. Try again.");
  }
  return { id: record.id, signedUrl: result.data.signedUrl };
}

export async function storageResponse(bucket: string, key: string, signal?: AbortSignal) {
  const { client } = getSupabaseStorage();
  const signed = await client.from(bucket).createSignedUrl(key, 60);
  if (signed.error) throw new Error("Unable to access stored file.");
  const response = await fetch(signed.data.signedUrl, { cache: "no-store", signal: signal ?? AbortSignal.timeout(20000), redirect: "error" });
  if (!response.ok || !response.body) throw new Error("Stored file is unavailable.");
  return response;
}

async function verifyStoredUpload(record: StorageObject) {
  const response = await storageResponse(record.bucket, record.key);
  const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const extension = record.fileName.split(".").pop()!.toLowerCase();
  if (!mime || !uploadFormats[extension]?.includes(mime)) {
    await response.body!.cancel();
    throw new Error("Stored content type does not match the file.");
  }
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > record.size || size > (record.type === "image" ? 5 : 10) * 1024 * 1024) throw new Error("Uploaded file exceeds its size limit.");
      chunks.push(part.value);
    }
  } finally { await reader.cancel(); }
  const bytes = Buffer.concat(chunks);
  return verifyUploadContent(bytes, { type: record.type as UploadIntent["type"], size: record.size, fileName: record.fileName, mime: record.mime });
}

export async function finishUpload(userId: string, id: string, input: unknown) {
  const parsed = itemUpdateSchema.parse(input);
  await consumeAuthLimit(`storage:finalize:${userId}`, 60, 3600);
  try {
    return await finalizeUploadRecord(userId, id, parsed, async (record) => {
      try { return await verifyStoredUpload(record); }
      catch { throw new UploadError("File verification failed. Check the format and contents, then upload again."); }
    });
  } catch (error) {
    // If a commit succeeded but its response was lost, attached rows remain safe.
    await abandonUploadRecord(userId, id);
    await runStorageCleanup(id).catch(() => { console.error("Upload cleanup deferred; durable record retained."); });
    throw error;
  }
}

export async function runStorageCleanup(id?: string) {
  const { client } = getSupabaseStorage();
  return cleanupStorageRecords(async (bucket, key) => {
    const result = await client.from(bucket).remove([key]);
    if (result.error) throw result.error;
  }, id);
}

export async function cleanupDeletedItem(userId: string, itemId: string) {
  const record = await getItemCleanupRecord(userId, itemId);
  if (record) await runStorageCleanup(record.id);
}
