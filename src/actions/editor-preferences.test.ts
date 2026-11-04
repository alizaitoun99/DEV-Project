import { beforeEach, expect, it, vi } from "vitest";

const { auth, updateMany } = vi.hoisted(() => ({ auth: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { updateMany } } }));
import { updateEditorPreferences } from "./editor-preferences";
import { DEFAULT_EDITOR_PREFERENCES } from "@/lib/editor-preferences";

beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({ user: { id: "owner" } });
  updateMany.mockResolvedValue({ count: 1 });
});

it("saves validated preferences only for the authenticated owner", async () => {
  const input = { ...DEFAULT_EDITOR_PREFERENCES, theme: "monokai", fontSize: 18 };
  expect(await updateEditorPreferences(input)).toEqual({ success: true, data: input });
  expect(updateMany).toHaveBeenCalledExactlyOnceWith({ where: { id: "owner" }, data: { editorPreferences: input } });
});

it("rejects unauthenticated requests", async () => {
  auth.mockResolvedValue(null);
  expect((await updateEditorPreferences(DEFAULT_EDITOR_PREFERENCES)).success).toBe(false);
  expect(updateMany).not.toHaveBeenCalled();
});

it.each([null, {}, { ...DEFAULT_EDITOR_PREFERENCES, fontSize: 999 },
  { ...DEFAULT_EDITOR_PREFERENCES, tabSize: -1 }, { ...DEFAULT_EDITOR_PREFERENCES, wordWrap: "on" },
  { ...DEFAULT_EDITOR_PREFERENCES, theme: "unknown" }, { ...DEFAULT_EDITOR_PREFERENCES, userId: "victim" },
])("rejects invalid or protected fields: %j", async (input) => {
  expect((await updateEditorPreferences(input)).success).toBe(false);
  expect(updateMany).not.toHaveBeenCalled();
});

it("handles deleted accounts", async () => {
  updateMany.mockResolvedValue({ count: 0 });
  expect(await updateEditorPreferences(DEFAULT_EDITOR_PREFERENCES)).toEqual({ success: false, error: "Account not found." });
});

it("hides database failures", async () => {
  updateMany.mockRejectedValue(new Error("private details"));
  expect(await updateEditorPreferences(DEFAULT_EDITOR_PREFERENCES)).toEqual({ success: false, error: "Unable to save editor preferences. Please try again." });
});
