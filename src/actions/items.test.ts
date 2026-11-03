import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, persist } = vi.hoisted(() => ({ auth: vi.fn(), persist: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/db/items", () => ({ updateItem: persist }));
import { updateItem } from "./items";
import { linkUpdateSchema } from "@/lib/item-validation";

beforeEach(() => { auth.mockReset(); persist.mockReset(); auth.mockResolvedValue({ user: { id: "owner" } }); });
const input = { title: "  Updated  ", tags: ["  React "] };

describe("updateItem action", () => {
  it("returns actionable URL feedback when persisted link validation fails", async () => {
    const result = linkUpdateSchema.safeParse({ ...input, url: null });
    if (result.success) throw new Error("Expected missing link URL to fail validation");
    persist.mockRejectedValue(result.error);
    expect(await updateItem("item", { ...input, url: null })).toEqual({ success: false, error: "url: URL is required for links." });
  });
  it("requires authentication before querying", async () => {
    auth.mockResolvedValue(null);
    expect((await updateItem("item", input)).success).toBe(false);
    expect(persist).not.toHaveBeenCalled();
  });
  it.each([
    { title: "   ", tags: [] }, { title: "Valid", tags: [" "] },
    { title: "Valid", tags: [], url: "javascript:alert(1)" },
    { title: "Valid", tags: [], url: "ftp://example.com" },
    { title: "Valid", tags: [], content: 7 },
  ])("rejects invalid payloads before querying: %j", async (payload) => {
    const result = await updateItem("item", payload);
    expect(result.success).toBe(false);
    expect(persist).not.toHaveBeenCalled();
  });
  it("uses session ownership, strips extra fields, and returns updated details", async () => {
    persist.mockResolvedValue({ id: "item", title: "Updated" });
    expect(await updateItem("item", { ...input, userId: "attacker", typeId: "other" })).toEqual({ success: true, data: { id: "item", title: "Updated" } });
    expect(persist).toHaveBeenCalledWith("owner", "item", { title: "Updated", tags: ["React"] });
  });
  it("reports missing or foreign items", async () => {
    persist.mockResolvedValue(null);
    expect(await updateItem("item", input)).toEqual({ success: false, error: "Item not found." });
  });
  it("accepts explicit nulls so optional fields and tags can be cleared", async () => {
    const payload = { title: "Title", description: null, content: null, language: null, url: null, tags: [] };
    persist.mockResolvedValue({ id: "item" });
    expect((await updateItem("item", payload)).success).toBe(true);
    expect(persist).toHaveBeenCalledWith("owner", "item", payload);
  });
  it.each(["http://example.com/path", "https://example.com/path?q=1"])("accepts safe link URL %s", async (url) => {
    persist.mockResolvedValue({ id: "item" });
    expect((await updateItem("item", { ...input, url })).success).toBe(true);
    expect(persist).toHaveBeenCalledWith("owner", "item", expect.objectContaining({ url }));
  });
  it("returns field-specific validation feedback", async () => {
    const result = await updateItem("item", { title: " ", tags: [], url: "invalid" });
    expect(result).toMatchObject({ success: false, error: expect.stringContaining("title:") });
    expect(result).toMatchObject({ error: expect.stringContaining("url:") });
    expect(persist).not.toHaveBeenCalled();
  });
  it("rejects malformed IDs", async () => {
    expect((await updateItem("", input)).success).toBe(false);
    expect(persist).not.toHaveBeenCalled();
  });
  it("hides database and session failure details", async () => {
    persist.mockRejectedValue(new Error("secret"));
    expect(JSON.stringify(await updateItem("item", input))).not.toContain("secret");
    auth.mockRejectedValue(new Error("secret auth"));
    expect(await updateItem("item", input)).toEqual({ success: false, error: "Unable to save item. Please try again." });
  });
});
