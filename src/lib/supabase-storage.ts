import "server-only";

import { StorageClient } from "@supabase/storage-js";
import { z } from "zod";

const storageConfigSchema = z.object({
  url: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && url.pathname === "/" &&
      !url.username && !url.password && !url.search && !url.hash;
  }, "Use the HTTPS project URL without a path or credentials."),
  secretKey: z.string().trim().startsWith("sb_secret_"),
  bucket: z.string().trim().min(1),
});

/** Server access is privileged: callers must authorize users and object ownership. */
export function getSupabaseStorage() {
  const result = storageConfigSchema.safeParse({
    url: process.env.SUPABASE_URL,
    secretKey: process.env.SUPABASE_SECRET_KEY,
    bucket: process.env.SUPABASE_STORAGE_BUCKET,
  });

  if (!result.success) {
    throw new Error(
      "Configure SUPABASE_URL (HTTPS project origin), SUPABASE_SECRET_KEY (sb_secret_ key), and SUPABASE_STORAGE_BUCKET before using storage.",
    );
  }

  const { url, secretKey, bucket } = result.data;
  const client = new StorageClient(`${new URL(url).origin}/storage/v1`, {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
  });

  return { client, bucket };
}
