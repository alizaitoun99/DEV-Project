import type { Prisma } from "@/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  assertCollectionCreationCapacity,
  assertItemCreationCapacity,
  assertProAccess,
  EntitlementError,
} from "./usage-limits";

const userId = "owner";

function mockTransaction(plan?: "FREE" | "PRO") {
  const query = vi.fn().mockResolvedValue(plan ? [{ plan, billingRevision: 0 }] : []);
  const itemCount = vi.fn();
  const collectionCount = vi.fn();
  const tx = {
    $queryRaw: query,
    item: { count: itemCount },
    collection: { count: collectionCount },
  } as unknown as Prisma.TransactionClient;
  return { tx, query, itemCount, collectionCount };
}

describe.each([
  { resource: "items", assertCapacity: assertItemCreationCapacity, countKey: "itemCount", limit: 50, code: "ITEM_LIMIT_REACHED" },
  { resource: "collections", assertCapacity: assertCollectionCreationCapacity, countKey: "collectionCount", limit: 3, code: "COLLECTION_LIMIT_REACHED" },
] as const)("$resource capacity", ({ assertCapacity, countKey, limit, code }) => {
  it("locks the owner before counting owned records and allows the last slot", async () => {
    const mocks = mockTransaction("FREE");
    const count = mocks[countKey].mockResolvedValue(limit - 1);
    const pending = Promise.withResolvers<{ plan: string; billingRevision: number }[]>();
    mocks.query.mockReturnValueOnce(pending.promise);

    const result = assertCapacity(mocks.tx, userId);
    expect(count).not.toHaveBeenCalled();
    const [sql, owner] = mocks.query.mock.calls[0];
    expect(sql.join("?")).toContain('WHERE "id" = ? FOR UPDATE');
    expect(owner).toBe(userId);
    pending.resolve([{ plan: "FREE", billingRevision: 0 }]);

    await result;
    expect(count).toHaveBeenCalledExactlyOnceWith({ where: { userId } });
  });

  it.each([limit, limit + 1])("denies creation at %i", async (owned) => {
    const mocks = mockTransaction("FREE");
    mocks[countKey].mockResolvedValue(owned);
    await expect(assertCapacity(mocks.tx, userId)).rejects.toMatchObject({
      name: EntitlementError.name,
      code,
    });
  });

  it("allows Pro without counting", async () => {
    const { tx, itemCount, collectionCount } = mockTransaction("PRO");
    await assertCapacity(tx, userId);
    expect(itemCount).not.toHaveBeenCalled();
    expect(collectionCount).not.toHaveBeenCalled();
  });

  it("fails for a missing owner before counting", async () => {
    const { tx, itemCount, collectionCount } = mockTransaction();
    await expect(assertCapacity(tx, userId)).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    expect(itemCount).not.toHaveBeenCalled();
    expect(collectionCount).not.toHaveBeenCalled();
  });
});

describe("Pro access", () => {
  it("denies Free accounts", async () => {
    await expect(assertProAccess(mockTransaction("FREE").tx, userId))
      .rejects.toMatchObject({ code: "PRO_REQUIRED" });
  });

  it("allows Pro accounts", async () => {
    await expect(assertProAccess(mockTransaction("PRO").tx, userId)).resolves.toBeUndefined();
  });
});
