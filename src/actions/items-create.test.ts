import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, persist } = vi.hoisted(() => ({ auth: vi.fn(), persist: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/db/items", () => ({ createItem: persist }));
import { createItem } from "./items";
import { z } from "zod";

beforeEach(() => { auth.mockReset(); persist.mockReset(); auth.mockResolvedValue({ user: { id: "owner" } }); });
const input = { type: "note", title: "  Example  ", tags: [" React "] };

describe("createItem action", () => {
  it("requires authentication before persistence", async () => {
    auth.mockResolvedValue(null);
    expect((await createItem(input)).success).toBe(false);
    expect(persist).not.toHaveBeenCalled();
  });
  it.each([
    { ...input, title: " " }, { ...input, type: "file" }, { ...input, type: "image" },
    { ...input, type: "link" }, { ...input, type: "link", url: null },
    { ...input, type: "link", url: "javascript:alert(1)" },
    { ...input, type: "link", url: "ftp://example.com" },
    { ...input, tags: [" "] }, { ...input, content: "a".repeat(500001) },
  ])("rejects invalid creation input %#", async (payload) => {
    expect((await createItem(payload)).success).toBe(false);
    expect(persist).not.toHaveBeenCalled();
  });
  it.each(["snippet", "prompt", "command", "note", "link"])("accepts %s and derives ownership from the session", async (type) => {
    persist.mockResolvedValue({ id: "created" });
    const payload = { ...input, type, ...(type === "link" ? { url: "https://example.com" } : {}) };
    expect(await createItem({ ...payload, userId: "attacker", typeId: "foreign", fileKey: "private" })).toEqual({ success: true, data: { id: "created" } });
    expect(persist).toHaveBeenCalledWith("owner", { ...payload, title: "Example", tags: ["React"] });
  });
  it("reports unavailable types", async () => {
    persist.mockResolvedValue(null);
    expect(await createItem(input)).toEqual({ success: false, error: "This item type is unavailable." });
  });
  it("hides session and database failures", async () => {
    persist.mockRejectedValue(new Error("private database"));
    expect(await createItem(input)).toEqual({ success: false, error: "Unable to create item. Please try again." });
    auth.mockRejectedValue(new Error("private auth"));
    expect(JSON.stringify(await createItem(input))).not.toContain("private");
  });
});

it("passes normalized collection choices to persistence with session ownership", async () => {
  persist.mockResolvedValue({ id: "created" });
  await createItem({ ...input, collectionIds: [" a ", "a", "b"], userId: "foreign" });
  expect(persist).toHaveBeenCalledWith("owner", expect.objectContaining({ collectionIds: ["a", "b"] }));
});
it("reports unavailable collection selections as actionable validation errors", async () => {
  persist.mockRejectedValue(new z.ZodError([{ code: "custom", path: ["collectionIds"], message: "Selected collection is unavailable." }]));
  expect(await createItem({ ...input, collectionIds: ["missing"] })).toEqual({ success: false, error: "Selected collection is unavailable." });
});
