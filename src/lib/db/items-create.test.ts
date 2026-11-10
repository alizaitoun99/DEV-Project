import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction, findFirst, create, count } = vi.hoisted(() => ({ transaction: vi.fn(), findFirst: vi.fn(), create: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction } }));
import { createItem } from "./items";
import type { ItemCreateInput } from "@/lib/item-validation";

beforeEach(() => {
  findFirst.mockReset(); create.mockReset(); transaction.mockReset();
  count.mockReset().mockResolvedValue(49);
  transaction.mockImplementation((callback) => callback({
    $queryRaw: vi.fn().mockResolvedValue([{ plan: "FREE" }]), itemType: { findFirst }, item: { create, count },
  }));
  findFirst.mockResolvedValue({ id: "system-type" });
  create.mockResolvedValue({ id: "created" });
});

describe("createItem persistence", () => {
  it.each(["snippet", "prompt", "command", "note", "link"] as const)("stores only fields supported by %s", async (type) => {
    const input: ItemCreateInput = { type, title: "Title", content: "Body", language: "bash", url: "https://example.com", tags: ["React", "react", "Next"] };
    expect(await createItem("owner", input)).toEqual({ id: "created" });
    expect(findFirst).toHaveBeenCalledWith({ where: { slug: type, isSystem: true, userId: null, kind: type === "link" ? "URL" : "TEXT" }, select: { id: true } });
    expect(create).toHaveBeenCalledWith({ data: {
      userId: "owner", typeId: "system-type", title: "Title", description: null,
      content: type === "link" ? null : "Body",
      language: ["snippet", "command"].includes(type) ? "bash" : null,
      url: type === "link" ? "https://example.com" : null,
      tags: { create: [
        { tag: { connectOrCreate: { where: { userId_slug: { userId: "owner", slug: "react" } }, create: { userId: "owner", slug: "react", name: "react" } } } },
        { tag: { connectOrCreate: { where: { userId_slug: { userId: "owner", slug: "next" } }, create: { userId: "owner", slug: "next", name: "Next" } } } },
      ] },
    }, select: { id: true } });
  });
  it("does not write if the system type is unavailable", async () => {
    findFirst.mockResolvedValue(null);
    expect(await createItem("owner", { type: "note", title: "Title", tags: [] })).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
  it("propagates transactional failures", async () => {
    create.mockRejectedValue(new Error("failed"));
    await expect(createItem("owner", { type: "note", title: "Title", tags: [] })).rejects.toThrow("failed");
  });
  it("blocks writes at the Free quota", async () => {
    count.mockResolvedValue(50);
    await expect(createItem("owner", { type: "note", title: "Title", tags: [] }))
      .rejects.toMatchObject({ code: "ITEM_LIMIT_REACHED" });
    expect(create).not.toHaveBeenCalled();
  });
});
