import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, findMany, auth } = vi.hoisted(() => ({ findFirst: vi.fn(), findMany: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { item: { findFirst, findMany } } }));
vi.mock("@/auth", () => ({ auth }));
import { getFilesByType, getItemDetail } from "./items";
import { GET } from "@/app/api/items/[id]/route";

beforeEach(() => { findFirst.mockReset(); findMany.mockReset(); auth.mockReset(); });
const context = { params: Promise.resolve({ id: "item-1" }) };
const request = new Request("http://localhost/api/items/item-1");

it("limits file listings to the owner and type without exposing storage keys or contents", async () => {
  findMany.mockResolvedValue([]);
  expect(await getFilesByType("owner-1", "file-type")).toEqual([]);
  const query = findMany.mock.calls[0][0];
  expect(query.where).toEqual({ userId: "owner-1", typeId: "file-type" });
  expect(query.orderBy).toEqual([{ updatedAt: "desc" }, { id: "asc" }]);
  expect(query.select).toMatchObject({ fileName: true, fileSize: true, createdAt: true });
  expect(query.select).not.toHaveProperty("fileKey");
  expect(query.select).not.toHaveProperty("content");
});

describe("item details", () => {
  it("scopes the item and related records to the owner and excludes storage keys", async () => {
    findFirst.mockResolvedValue(null);
    expect(await getItemDetail("owner-1", "item-1")).toBeNull();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "item-1", userId: "owner-1" },
      select: expect.objectContaining({
        tags: expect.objectContaining({ where: { tag: { userId: "owner-1" } } }),
        collections: expect.objectContaining({ where: { collection: { userId: "owner-1" } } }),
      }),
    }));
    expect(findFirst.mock.calls[0][0].select).not.toHaveProperty("fileKey");
  });

  it("serializes large file sizes and dates for JSON", async () => {
    findFirst.mockResolvedValue({ fileSize: 9007199254740993n, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-02-01") });
    const result = await getItemDetail("owner", "item");
    expect(result?.fileSize).toBe("9007199254740993");
    expect(result?.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("rejects unauthenticated requests before querying", async () => {
    auth.mockResolvedValue(null);
    expect((await GET(request, context)).status).toBe(401);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns the complete owned detail as non-cacheable JSON with nullable file metadata", async () => {
    auth.mockResolvedValue({ user: { id: "owner" } });
    const saved = {
      id: "item-1", title: "Example", description: null, content: "const value = 1;",
      url: null, language: "typescript", isPinned: true, isFavorite: false,
      fileName: null, fileSize: null, fileMimeType: null,
      type: { slug: "snippet", name: "Snippets" },
      tags: [{ tag: { name: "example" } }],
      collections: [{ collection: { id: "collection-1", name: "Examples" } }],
      createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-02-01"),
    };
    findFirst.mockResolvedValue(saved);

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ data: {
      ...saved, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z",
    } });
  });

  it("fails safely if session lookup fails without querying items", async () => {
    auth.mockRejectedValue(new Error("private authentication details"));
    const response = await GET(request, context);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to load item. Please try again." });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 for unavailable or foreign items", async () => {
    auth.mockResolvedValue({ user: { id: "owner" } });
    findFirst.mockResolvedValue(null);
    const response = await GET(request, context);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: "item-1", userId: "owner" });
  });

  it("returns safe errors when the database fails", async () => {
    auth.mockResolvedValue({ user: { id: "owner" } });
    findFirst.mockRejectedValue(new Error("private database details"));
    const response = await GET(request, context);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private database");
  });
});
