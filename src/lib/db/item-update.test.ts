import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, update, transaction } = vi.hoisted(() => ({ findFirst: vi.fn(), update: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction } }));
import { updateItem } from "./items";

beforeEach(() => {
  findFirst.mockReset(); update.mockReset(); transaction.mockReset();
  transaction.mockImplementation(async (callback) => callback({
    $queryRaw: async () => [{ plan: "PRO" }], item: { findFirst, update },
  }));
});

describe("item update transaction", () => {
  it.each([undefined, null, "", "   ", "not a URL", "javascript:alert(1)", "ftp://example.com"])("rejects invalid link destination %j before mutating anything", async (url) => {
    findFirst.mockResolvedValueOnce({ type: { slug: "link" } });
    await expect(updateItem("owner", "item", { title: "Title", url, tags: [] })).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
  it.each(["http://example.com/path", "https://example.com/path?q=1"])("persists a valid trimmed link destination %s", async (url) => {
    findFirst.mockResolvedValueOnce({ type: { slug: "link" } }).mockResolvedValueOnce(null);
    await updateItem("owner", "item", { title: "Title", url: `  ${url}  `, tags: [] });
    expect(update.mock.calls[0][0].data.url).toBe(url);
  });
  it("does not mutate foreign or missing items", async () => {
    findFirst.mockResolvedValue(null);
    expect(await updateItem("owner", "foreign", { title: "Title", tags: [] })).toBeNull();
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: "foreign", userId: "owner" });
    expect(update).not.toHaveBeenCalled();
  });
  it("replaces tags with deduplicated owner-scoped tags and returns serialized details", async () => {
    findFirst.mockResolvedValueOnce({ type: { slug: "snippet" } }).mockResolvedValueOnce({ fileSize: null, createdAt: new Date(0), updatedAt: new Date(0) });
    const result = await updateItem("owner", "item", { title: "Title", content: "new", language: "ts", url: "https://ignored.example", tags: ["React", "react", "New Tag"] });
    expect(result).toMatchObject({ fileSize: null, createdAt: "1970-01-01T00:00:00.000Z", updatedAt: "1970-01-01T00:00:00.000Z" });
    const mutation = update.mock.calls[0][0];
    expect(mutation.where).toEqual({ id: "item", userId: "owner" });
    expect(mutation.data).toMatchObject({ content: "new", language: "ts", tags: { deleteMany: {} } });
    expect(mutation.data).not.toHaveProperty("url");
    expect(mutation.data.tags.create).toHaveLength(2);
    expect(mutation.data.tags.create[0].tag.connectOrCreate.where).toEqual({ userId_slug: { userId: "owner", slug: "react" } });
    expect(findFirst.mock.calls[1][0].where).toEqual({ id: "item", userId: "owner" });
  });
  it.each(["snippet", "prompt", "command", "note"])("can clear text fields and remove all tags for %s", async (slug) => {
    findFirst.mockResolvedValueOnce({ type: { slug } }).mockResolvedValueOnce(null);
    await updateItem("owner", "item", { title: "Title", description: null, content: null, language: null, tags: [] });
    const data = update.mock.calls[0][0].data;
    expect(data).toMatchObject({ description: null, content: null, tags: { deleteMany: {}, create: [] } });
    if (["snippet", "command"].includes(slug)) expect(data.language).toBeNull();
    else expect(data).not.toHaveProperty("language");
  });
  it.each(["file", "image", "link"])("preserves non-editable fields for %s", async (slug) => {
    findFirst.mockResolvedValueOnce({ type: { slug } }).mockResolvedValueOnce(null);
    await updateItem("owner", "item", { title: "Title", content: "ignored", language: "ignored", url: "https://example.com", tags: [] });
    const data = update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("content"); expect(data).not.toHaveProperty("language");
    expect(data).not.toHaveProperty("collections"); expect(data).not.toHaveProperty("fileKey");
    if (slug === "link") expect(data.url).toBe("https://example.com"); else expect(data).not.toHaveProperty("url");
    expect(data.tags.create).toEqual([]);
  });
  it("propagates transaction failures for safe action handling", async () => {
    findFirst.mockResolvedValue({ type: { slug: "note" } });
    update.mockRejectedValue(new Error("rollback"));
    await expect(updateItem("owner", "item", { title: "Title", tags: [] })).rejects.toThrow("rollback");
  });
});
