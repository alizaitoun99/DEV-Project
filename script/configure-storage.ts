import "dotenv/config";
import { getSupabaseStorage } from "../src/lib/supabase-storage";
import { uploadFormats } from "../src/lib/upload-validation";

const { client, bucket } = getSupabaseStorage();
const mimeTypes = [...new Set(Object.values(uploadFormats).flat())];
if (process.argv.includes("--apply")) {
  const result = await client.updateBucket(bucket, {
    public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: mimeTypes,
  });
  if (result.error) throw new Error("Unable to configure storage bucket.");
}
const result = await client.getBucket(bucket);
if (result.error || !result.data) throw new Error("Unable to inspect storage bucket.");
console.log(JSON.stringify({ private: !result.data.public, maxBytes: result.data.file_size_limit, allowedMimeTypes: result.data.allowed_mime_types }));
