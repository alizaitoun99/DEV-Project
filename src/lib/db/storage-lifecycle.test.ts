import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(), transaction: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateMany: vi.fn(), count: vi.fn(), type: vi.fn(), item: vi.fn(), items: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: mocks.transaction,
  storageObject: { findMany: mocks.findMany, updateMany: mocks.updateMany },
} }));
import { abandonUploadRecord, cleanupStorageRecords, createUploadRecord, enqueueAccountStorage, finalizeUploadRecord } from "./items";

const input = { type: "file" as const, fileName: "note.txt", size: 3, mime: "text/plain" };
const record = { ...input, id: "upload", userId: "owner", bucket: "private", key: "owner/key", state: "pending", expiresAt: new Date(Date.now() + 3600000), retryAt: new Date(0), itemId: null };
const metadata = { title: "Note", tags: ["React", "react"] };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockResolvedValue([{ id: "owner", plan: "PRO" }]);
  mocks.count.mockResolvedValue(0);
  mocks.findFirst.mockResolvedValue(record);
  mocks.type.mockResolvedValue({ id: "type" });
  mocks.item.mockResolvedValue({ id: "item" });
  mocks.create.mockResolvedValue(record);
  mocks.transaction.mockImplementation((callback) => callback({
    $queryRaw: mocks.query,
    storageObject: { findFirst: mocks.findFirst, findMany: mocks.findMany, create: mocks.create, update: mocks.update, delete: mocks.delete, updateMany: mocks.updateMany, count: mocks.count },
    itemType: { findFirst: mocks.type }, item: { create: mocks.item, findMany: mocks.items },
  }));
});

describe("upload persistence", () => {
  it("generates an owned unique key and durable intent before issuing upload access", async () => {
    await createUploadRecord("owner", "private", input);
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ ...input, userId: "owner", bucket: "private", key: expect.stringMatching(/^owner\/[a-f0-9-]+$/), expiresAt: expect.any(Date) }) });
  });
  it("denies deleted owners and excessive pending uploads", async () => {
    mocks.query.mockResolvedValueOnce([]);
    await expect(createUploadRecord("gone", "private", input)).rejects.toThrow("Account");
    mocks.count.mockResolvedValueOnce(20);
    await expect(createUploadRecord("owner", "private", input)).rejects.toThrow("pending");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("verifies the owned record and persists only server-verified file fields", async () => {
    const verify = vi.fn().mockResolvedValue("text/plain");
    expect(await finalizeUploadRecord("owner", "upload", metadata, verify)).toEqual({ id: "item" });
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: "upload", userId: "owner" } });
    expect(verify).toHaveBeenCalledWith(record);
    expect(mocks.item).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "owner", fileKey: "owner/key", fileName: "note.txt", fileSize: 3, fileMimeType: "text/plain" }), select: { id: true } });
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "upload" }, data: { state: "attached", itemId: "item", mime: "text/plain" } });
  });
  it.each([null, { ...record, state: "cleanup" }, { ...record, expiresAt: new Date(0) }])("rejects missing, rejected, or expired records", async (value) => {
    mocks.findFirst.mockResolvedValue(value);
    const verify = vi.fn();
    await expect(finalizeUploadRecord("owner", "upload", metadata, verify)).rejects.toThrow();
    expect(verify).not.toHaveBeenCalled();
    expect(mocks.item).not.toHaveBeenCalled();
  });
  it("makes finalization retries idempotent", async () => {
    mocks.query.mockResolvedValueOnce([{ plan: "FREE" }]);
    mocks.findFirst.mockResolvedValue({ ...record, state: "attached", itemId: "item" });
    expect(await finalizeUploadRecord("owner", "upload", metadata, vi.fn())).toEqual({ id: "item" });
    expect(mocks.item).not.toHaveBeenCalled();
  });
  it("denies Free upload creation and blocks finalization after downgrade", async () => {
    mocks.query.mockResolvedValue([{ plan: "FREE" }]);
    const verify = vi.fn();
    await expect(createUploadRecord("owner", "private", input)).rejects.toMatchObject({ code: "PRO_REQUIRED" });
    await expect(finalizeUploadRecord("owner", "upload", metadata, verify)).rejects.toMatchObject({ code: "PRO_REQUIRED" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
    expect(mocks.item).not.toHaveBeenCalled();
  });
  it("does not attach rejected bytes or failed persistence", async () => {
    await expect(finalizeUploadRecord("owner", "upload", metadata, vi.fn().mockRejectedValue(new Error("invalid")))).rejects.toThrow("invalid");
    expect(mocks.item).not.toHaveBeenCalled();
    mocks.item.mockRejectedValueOnce(new Error("database"));
    await expect(finalizeUploadRecord("owner", "upload", metadata, vi.fn().mockResolvedValue("text/plain"))).rejects.toThrow("database");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("abandonment cannot transition foreign or attached records", async () => {
    await abandonUploadRecord("owner", "upload");
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: "upload", userId: "owner", state: "pending" }, data: { state: "cleanup", retryAt: expect.any(Date) } });
  });
});

describe("cleanup recovery", () => {
  beforeEach(() => {
    mocks.findMany.mockResolvedValue([{ id: "upload" }]);
    mocks.query.mockResolvedValue([{ ...record, state: "cleanup" }]);
  });
  it("retains a successful cleanup tombstone for late signed uploads", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    expect(await cleanupStorageRecords(remove)).toEqual({ processed: 1, failures: 0 });
    expect(remove).toHaveBeenCalledWith("private", "owner/key");
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "upload" }, data: expect.objectContaining({ state: "cleanup", lastError: null, retryAt: record.expiresAt }) });
    expect(mocks.delete).not.toHaveBeenCalled();
  });
  it.each(["pending", "cleanup"])("retires expired %s records only after successful final removal", async (state) => {
    mocks.query.mockResolvedValue([{ ...record, state, expiresAt: new Date(0) }]);
    const remove = vi.fn().mockResolvedValue(undefined);
    expect(await cleanupStorageRecords(remove)).toEqual({ processed: 1, failures: 0 });
    expect(remove).toHaveBeenCalledWith("private", "owner/key");
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: "upload" } });
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(mocks.delete.mock.invocationCallOrder[0]);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("retains failed removal and schedules a retry", async () => {
    mocks.query.mockResolvedValue([{ ...record, state: "cleanup", expiresAt: new Date(0) }]);
    expect(await cleanupStorageRecords(vi.fn().mockRejectedValue(new Error("offline")))).toEqual({ processed: 1, failures: 1 });
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "upload" }, data: expect.objectContaining({ state: "cleanup", lastError: "Storage removal failed", attempts: { increment: 1 } }) });
    expect(mocks.delete).not.toHaveBeenCalled();
  });
  it.each([[], [{ ...record, state: "attached" }], [{ ...record, retryAt: new Date(Date.now() + 100000) }]].map((locked) => ({ locked })))("does not remove locked, finalized, or not-yet-due records", async ({ locked }) => {
    mocks.query.mockResolvedValue(locked);
    const remove = vi.fn();
    await cleanupStorageRecords(remove);
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("account storage lifecycle", () => {
  it("queues every owned record including pending uploads before cascade", async () => {
    mocks.items.mockResolvedValue([{ fileKey: "owner/key" }]);
    mocks.findMany.mockResolvedValue([{ key: "owner/key" }]);
    await enqueueAccountStorage({ $queryRaw: mocks.query, item: { findMany: mocks.items }, storageObject: { findMany: mocks.findMany, updateMany: mocks.updateMany } } as unknown as Parameters<typeof enqueueAccountStorage>[0], "owner");
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { userId: "owner" }, data: { state: "cleanup", retryAt: expect.any(Date) } });
  });
  it("blocks deletion when it would lose an untracked legacy key", async () => {
    mocks.items.mockResolvedValue([{ fileKey: "legacy" }]);
    mocks.findMany.mockResolvedValue([]);
    await expect(enqueueAccountStorage({ $queryRaw: mocks.query, item: { findMany: mocks.items }, storageObject: { findMany: mocks.findMany } } as unknown as Parameters<typeof enqueueAccountStorage>[0], "owner")).rejects.toThrow("Untracked");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
