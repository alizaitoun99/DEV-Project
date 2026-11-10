import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ bucket: vi.fn(), from: vi.fn(), signed: vi.fn(), readSigned: vi.fn(), create: vi.fn(), finalize: vi.fn(), abandon: vi.fn(), cleanup: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/supabase-storage", () => ({ getSupabaseStorage: () => ({ bucket: "private", client: { getBucket: m.bucket, from: m.from } }) }));
vi.mock("@/lib/auth-rate-limit", () => ({ consumeAuthLimit: m.limit }));
vi.mock("@/lib/db/items", () => ({ createUploadRecord: m.create, finalizeUploadRecord: m.finalize, abandonUploadRecord: m.abandon, cleanupStorageRecords: m.cleanup }));
import { beginUpload, finishUpload } from "./storage-uploads";
import { EntitlementError } from "./billing/usage-limits";
const input = { type: "file", fileName: "a.txt", size: 3, mime: "text/plain" };
beforeEach(() => {
  vi.resetAllMocks();
  m.bucket.mockResolvedValue({ data: { public: false, file_size_limit: 10485760, allowed_mime_types: ["text/plain"] } });
  m.from.mockReturnValue({ createSignedUploadUrl: m.signed, createSignedUrl: m.readSigned });
  m.create.mockResolvedValue({ id: "upload", key: "owner/key" });
  m.signed.mockResolvedValue({ data: { signedUrl: "https://storage/upload" } });
  m.readSigned.mockResolvedValue({ data: { signedUrl: "https://storage/read" } });
});
it.each([
  { body: "abc", mime: "text/plain", valid: true },
  { body: "abc", mime: "image/png", valid: false },
  { body: "oversized", mime: "text/plain", valid: false },
  { body: "a", mime: "text/plain", valid: false },
])("verifies downloaded bytes and MIME before persistence: $mime/$body", async ({ body, mime, valid }) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { headers: { "Content-Type": mime } })));
  m.finalize.mockImplementation(async (_owner, _id, _metadata, verify) => {
    const verified = await verify({ ...input, key: "owner/key", bucket: "private" });
    expect(verified).toBe("text/plain");
    return { id: "item" };
  });
  try {
    const result = finishUpload("owner", "upload", { title: "Title", tags: [] });
    if (valid) await expect(result).resolves.toEqual({ id: "item" });
    else { await expect(result).rejects.toThrow("verification"); expect(m.abandon).toHaveBeenCalledWith("owner", "upload"); }
  } finally { vi.unstubAllGlobals(); }
});
it("persists intent before issuing a non-overwriting object-scoped URL", async () => {
  expect(await beginUpload("owner", input)).toEqual({ id: "upload", signedUrl: "https://storage/upload" });
  expect(m.create).toHaveBeenCalledWith("owner", "private", input);
  expect(m.signed).toHaveBeenCalledWith("owner/key", { upsert: false });
  expect(m.create.mock.invocationCallOrder[0]).toBeLessThan(m.signed.mock.invocationCallOrder[0]);
});
it.each([
  { public: true, file_size_limit: 10485760, allowed_mime_types: ["text/plain"] },
  { public: false, file_size_limit: null, allowed_mime_types: ["text/plain"] },
  { public: false, file_size_limit: 10485760, allowed_mime_types: ["*"] },
])("fails closed for unsafe bucket settings", async (data) => {
  m.bucket.mockResolvedValue({ data });
  await expect(beginUpload("owner", input)).rejects.toThrow("bucket");
  expect(m.create).not.toHaveBeenCalled();
});
it("retains cleanup when signing fails", async () => {
  m.signed.mockResolvedValue({ error: new Error("offline") });
  await expect(beginUpload("owner", input)).rejects.toThrow("prepare");
  expect(m.abandon).toHaveBeenCalledWith("owner", "upload");
});
it("never signs a Free upload and queues cleanup if the account downgrades mid-upload", async () => {
  const denied = new EntitlementError("PRO_REQUIRED");
  m.create.mockRejectedValue(denied);
  await expect(beginUpload("owner", input)).rejects.toBe(denied);
  expect(m.signed).not.toHaveBeenCalled();

  m.finalize.mockRejectedValue(denied);
  await expect(finishUpload("owner", "upload", { title: "Title", tags: [] })).rejects.toBe(denied);
  expect(m.abandon).toHaveBeenCalledWith("owner", "upload");
});
it("marks failed finalization for cleanup even when immediate removal fails", async () => {
  m.finalize.mockRejectedValue(new Error("database failed"));
  m.cleanup.mockRejectedValue(new Error("offline"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(finishUpload("owner", "upload", { title: "Title", tags: [] })).rejects.toThrow("database failed");
  expect(m.abandon).toHaveBeenCalledWith("owner", "upload");
  expect(m.cleanup).toHaveBeenCalledWith(expect.any(Function), "upload");
});
