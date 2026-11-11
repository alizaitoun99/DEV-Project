import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateAutoTags } from "./ai";
import { AuthRateLimitError } from "@/lib/auth-rate-limit";
import { EntitlementError } from "@/lib/billing/usage-limits";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  assertProAccess: vi.fn(),
  enforceAiRateLimit: vi.fn(),
  create: vi.fn(),
  tx: {},
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (run: (tx: typeof mocks.tx) => unknown) => run(mocks.tx) },
}));
vi.mock("@/lib/billing/usage-limits", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/billing/usage-limits")>(),
  assertProAccess: mocks.assertProAccess,
}));
vi.mock("@/lib/rate-limit", () => ({ enforceAiRateLimit: mocks.enforceAiRateLimit }));
vi.mock("@/lib/openai", () => ({
  AI_MODEL: "gpt-6-luna",
  getOpenAI: () => ({ responses: { create: mocks.create } }),
}));

describe("generateAutoTags", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "owner" } });
    mocks.create.mockResolvedValue({
      status: "completed", output_text: '{"tags":[" Next.js ","React","SSR"]}',
    });
  });

  it("requires authentication before using the quota or provider", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(generateAutoTags({ title: "Next.js" })).resolves.toMatchObject({ success: false, error: expect.stringMatching(/sign in/i) });
    expect(mocks.assertProAccess).not.toHaveBeenCalled();
    expect(mocks.enforceAiRateLimit).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects invalid input before charging quota", async () => {
    await expect(generateAutoTags({ title: "   " })).resolves.toMatchObject({ success: false });
    expect(mocks.enforceAiRateLimit).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("enforces the current Pro entitlement before charging quota", async () => {
    mocks.assertProAccess.mockRejectedValue(new EntitlementError("PRO_REQUIRED"));
    await expect(generateAutoTags({ title: "Next.js" })).resolves.toMatchObject({ success: false, error: expect.stringContaining("Pro") });
    expect(mocks.enforceAiRateLimit).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("blocks generation when the owner has reached the hourly limit", async () => {
    mocks.enforceAiRateLimit.mockRejectedValue(new AuthRateLimitError(60));
    await expect(generateAutoTags({ title: "Next.js" })).resolves.toMatchObject({ success: false, error: expect.stringContaining("Too many attempts") });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("reserves quota for the signed-in owner and bounds the Responses API input", async () => {
    const content = "x".repeat(2000);
    await expect(generateAutoTags({ title: " Next.js ", content: content + "truncated" })).resolves.toEqual({
      success: true, data: ["next.js", "react", "ssr"],
    });
    expect(mocks.assertProAccess).toHaveBeenCalledWith(mocks.tx, "owner");
    expect(mocks.enforceAiRateLimit).toHaveBeenCalledWith("owner", mocks.tx);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-6-luna",
      input: `Item JSON:\n${JSON.stringify({ title: "Next.js", content })}`,
      store: false,
      text: { format: { type: "json_object" } },
    }));
  });

  it("accepts a bare tag array and deduplicates case variants", async () => {
    mocks.create.mockResolvedValue({ status: "completed", output_text: '["CSS","css","HTML","web"]' });
    await expect(generateAutoTags({ title: "CSS" })).resolves.toEqual({ success: true, data: ["css", "html", "web"] });
  });

  it.each([
    ["completed", "not json"],
    ["completed", '{"tags":["react","web","invalid,tag"]}'],
    ["incomplete", '{"tags":["react","web","next.js"]}'],
  ])("rejects unusable provider output (%s, %s)", async (status, output_text) => {
    mocks.create.mockResolvedValue({ status, output_text });
    await expect(generateAutoTags({ title: "Next.js" })).resolves.toMatchObject({ success: false });
  });

  it("returns a generic error for provider failures", async () => {
    mocks.create.mockRejectedValue(new Error("private provider details"));
    await expect(generateAutoTags({ title: "Next.js" })).resolves.toEqual({
      success: false, error: "Unable to suggest tags right now. Please try again.",
    });
  });
});
