import { beforeEach, expect, it, vi } from "vitest";

const { auth, updateMany, revalidatePath } = vi.hoisted(() => ({ auth: vi.fn(), updateMany: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/prisma", () => ({ prisma: { item: { updateMany } } }));
import { toggleItemPin } from "./pins";

beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({ user: { id: "owner" } });
  updateMany.mockResolvedValue({ count: 1 });
});

it.each([true, false])("sets pin to %s using session ownership", async (isPinned) => {
  expect(await toggleItemPin({ id: " id ", isPinned, userId: "foreign" })).toEqual({ success: true });
  expect(updateMany).toHaveBeenCalledExactlyOnceWith({ where: { id: "id", userId: "owner" }, data: { isPinned } });
  expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
});

it("rejects unauthenticated requests", async () => {
  auth.mockResolvedValue(null);
  expect((await toggleItemPin({ id: "id", isPinned: true })).success).toBe(false);
  expect(updateMany).not.toHaveBeenCalled();
});

it.each([null, {}, { id: " ", isPinned: true }, { id: "id", isPinned: "true" }, { id: "x".repeat(201), isPinned: true }])("rejects invalid input %j", async (input) => {
  expect((await toggleItemPin(input)).success).toBe(false);
  expect(updateMany).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

it("handles missing and foreign-owned items", async () => {
  updateMany.mockResolvedValue({ count: 0 });
  expect(await toggleItemPin({ id: "foreign", isPinned: true })).toEqual({ success: false, error: "Item not found." });
  expect(revalidatePath).not.toHaveBeenCalled();
});

it("hides database errors and allows retry", async () => {
  updateMany.mockRejectedValueOnce(new Error("private details"));
  expect(await toggleItemPin({ id: "id", isPinned: true })).toEqual({ success: false, error: "Unable to update pin. Please try again." });
  expect(revalidatePath).not.toHaveBeenCalled();
  expect(await toggleItemPin({ id: "id", isPinned: true })).toEqual({ success: true });
});
