import { beforeEach, expect, it, vi } from "vitest";

const { create, auth, findMany, transaction, count } = vi.hoisted(() => ({ create: vi.fn(), auth: vi.fn(), findMany: vi.fn(), transaction: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction, collection: { findMany } } }));
vi.mock("@/auth", () => ({ auth }));
import { createCollection } from "./collections";
import { POST, GET } from "@/app/api/collections/route";

beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({ user: { id: "owner" } });
  create.mockResolvedValue({ id: "new", name: "Notes", description: null });
  count.mockResolvedValue(2);
  transaction.mockImplementation((callback) => callback({
    $queryRaw: vi.fn().mockResolvedValue([{ plan: "FREE" }]), collection: { create, count },
  }));
});

it("returns a stable error and skips the write at the Free quota", async () => {
  count.mockResolvedValue(3);
  const response = await POST(request({ name: "Notes" }));
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ success: false, code: "COLLECTION_LIMIT_REACHED" });
  expect(create).not.toHaveBeenCalled();
});

function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/collections", {
    method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

it("persists normalized fields with server-derived ownership and safe defaults", async () => {
  const response = await POST(request({ name: " Notes ", description: " ", userId: "attacker", isFavorite: true, defaultTypeId: "foreign" }));
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ success: true, data: { id: "new", name: "Notes", description: null } });
  expect(create).toHaveBeenCalledWith({
    data: { userId: "owner", name: "Notes", description: null },
    select: { id: true, name: true, description: true },
  });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

it("saves descriptions and supports an omitted description", async () => {
  await createCollection("owner", { name: " Notes ", description: " My notes " });
  expect(create.mock.calls[0][0].data.description).toBe("My notes");
  await createCollection("owner", { name: "Notes" });
  expect(create.mock.calls[1][0].data.description).toBeNull();
});

it.each([{ name: " " }, { name: 4 }, { name: "x".repeat(501) }, { name: "Notes", description: "x".repeat(10001) }])("rejects invalid fields without writes: %j", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(create).not.toHaveBeenCalled();
});

it("validates direct database utility input", async () => {
  await expect(createCollection("owner", { name: " " })).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
});

it("rejects unauthenticated callers", async () => {
  auth.mockResolvedValue(null);
  expect((await POST(request({ name: "Notes" }))).status).toBe(401);
  expect(create).not.toHaveBeenCalled();
});

it("rejects cross-origin mutations before authenticating", async () => {
  expect((await POST(request({ name: "Notes" }, "https://other.example"))).status).toBe(403);
  expect(auth).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});

it("rejects malformed JSON and oversized bodies", async () => {
  const malformed = new Request("http://localhost/api/collections", { method: "POST", headers: { origin: "http://localhost" }, body: "{" });
  expect((await POST(malformed)).status).toBe(400);
  expect((await POST(request({ name: "x".repeat(100001) }))).status).toBe(413);
  expect(create).not.toHaveBeenCalled();
});

it("returns a safe retryable error when persistence fails", async () => {
  create.mockRejectedValue(new Error("private database credentials"));
  const response = await POST(request({ name: "Notes" }));
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ success: false, error: "Unable to create collection. Please try again." });
});

it("returns only the current owner's collection options without caching", async () => {
  findMany.mockResolvedValue([{ id: "a", name: "Notes" }]);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, data: [{ id: "a", name: "Notes" }] });
  expect(findMany).toHaveBeenCalledWith({ where: { userId: "owner" }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true } });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("rejects unauthenticated collection option requests", async () => {
  auth.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect(findMany).not.toHaveBeenCalled();
});
it("hides collection option query failures", async () => {
  findMany.mockRejectedValue(new Error("private database detail"));
  const response = await GET();
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private database detail");
});
