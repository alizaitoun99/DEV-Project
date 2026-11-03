import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), begin: vi.fn(), finish: vi.fn(), abandon: vi.fn(), item: vi.fn(), record: vi.fn(), response: vi.fn() }));
vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/auth-rate-limit", () => ({ AuthRateLimitError: class extends Error {} }));
vi.mock("@/lib/storage-uploads", () => ({ beginUpload: m.begin, finishUpload: m.finish, storageResponse: m.response, UploadError: class extends Error {} }));
vi.mock("@/lib/db/items", () => ({ abandonUploadRecord: m.abandon, getStoredItem: m.item, getStorageRecord: m.record }));
import { POST } from "@/app/api/uploads/route";
import { GET } from "@/app/api/items/[id]/download/route";
const context = { params: Promise.resolve({ id: "item" }) };
function request(body: unknown, origin = "https://app.test") {
  return new Request("https://app.test/api/uploads", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue({ user: { id: "owner" } }); });
it("rejects unauthenticated uploads and downloads", async () => {
  m.auth.mockResolvedValue(null);
  expect((await POST(request({ action: "begin", file: {} }))).status).toBe(401);
  expect((await GET(new Request("https://app.test/api/items/item/download"), context)).status).toBe(401);
  expect(m.begin).not.toHaveBeenCalled(); expect(m.item).not.toHaveBeenCalled();
});
it("rejects cross-origin upload mutations", async () => {
  expect((await POST(request({ action: "begin", file: {} }, "https://evil.test"))).status).toBe(403);
  expect(m.begin).not.toHaveBeenCalled();
});
it("uses session ownership for upload intent and finalization", async () => {
  await POST(request({ action: "begin", file: { userId: "foreign" } }));
  expect(m.begin).toHaveBeenCalledWith("owner", { userId: "foreign" });
  await POST(request({ action: "finish", id: "upload", item: { title: "Title" }, userId: "foreign" }));
  expect(m.finish).toHaveBeenCalledWith("owner", "upload", { title: "Title" });
});
it("hides internal errors from clients", async () => {
  m.begin.mockRejectedValue(new Error("database password=secret"));
  const response = await POST(request({ action: "begin", file: {} }));
  expect(await response.text()).not.toContain("secret");
});
it("does not access storage for foreign or missing items", async () => {
  m.item.mockResolvedValue(null);
  expect((await GET(new Request("https://app.test/api/items/item/download"), context)).status).toBe(404);
  expect(m.item).toHaveBeenCalledWith("owner", "item");
  expect(m.response).not.toHaveBeenCalled();
});
it.each(["image/svg+xml", "text/html", "application/pdf"])("forces attachments for %s even when preview requested", async (mime) => {
  m.item.mockResolvedValue({ fileKey: "owner/key", fileName: 'a"\r\n.svg', fileMimeType: mime });
  m.record.mockResolvedValue({ bucket: "private" });
  m.response.mockResolvedValue(new Response("bytes"));
  const response = await GET(new Request("https://app.test/api/items/item/download?preview=1"), context);
  expect(response.headers.get("Content-Disposition")).toMatch(/^attachment;/);
  expect(response.headers.get("Content-Disposition")).toContain("%22%0D%0A");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
  expect(await response.text()).toBe("bytes");
});
it("streams verified bitmap previews privately", async () => {
  m.item.mockResolvedValue({ fileKey: "owner/key", fileName: "a.png", fileMimeType: "image/png" });
  m.record.mockResolvedValue({ bucket: "private" });
  m.response.mockResolvedValue(new Response("bytes"));
  const response = await GET(new Request("https://app.test/api/items/item/download?preview=1"), context);
  expect(response.headers.get("Content-Disposition")).toMatch(/^inline;/);
  expect(response.headers.get("Content-Type")).toBe("image/png");
});
