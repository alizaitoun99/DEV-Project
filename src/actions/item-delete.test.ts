import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, remove } = vi.hoisted(() => ({ auth: vi.fn(), remove: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/db/items", () => ({ deleteItem: remove }));
vi.mock("@/lib/storage-uploads", () => ({ cleanupDeletedItem: vi.fn() }));
import { deleteItem } from "./items";

beforeEach(() => { vi.resetAllMocks(); auth.mockResolvedValue({ user: { id: "owner" } }); });

describe("deleteItem action", () => {
  it("requires a session", async () => {
    auth.mockResolvedValue(null);
    expect(await deleteItem("item")).toEqual({ success: false, error: "Please sign in again." });
    expect(remove).not.toHaveBeenCalled();
  });
  it.each([null, {}, "", " ", "a".repeat(201)])("rejects invalid IDs: %j", async (id) => {
    expect(await deleteItem(id)).toEqual({ success: false, error: "Invalid item ID." });
    expect(remove).not.toHaveBeenCalled();
  });
  it("deletes using the session owner and validated ID", async () => {
    remove.mockResolvedValue("deleted");
    expect(await deleteItem(" item ")).toEqual({ success: true });
    expect(remove).toHaveBeenCalledWith("owner", "item");
  });
  it("reports missing and foreign items identically", async () => {
    remove.mockResolvedValue("not-found");
    expect(await deleteItem("foreign")).toEqual({ success: false, error: "Item not found." });
  });
  it("explains stored-file protection", async () => {
    remove.mockResolvedValue("stored-file");
    expect(await deleteItem("file")).toMatchObject({ success: false, error: expect.stringContaining("file cleanup") });
  });
  it("hides database and session errors", async () => {
    remove.mockRejectedValue(new Error("secret"));
    const failure = { success: false, error: "Unable to delete item. Please try again." };
    expect(await deleteItem("item")).toEqual(failure);
    auth.mockRejectedValue(new Error("secret"));
    expect(await deleteItem("item")).toEqual(failure);
  });
});
