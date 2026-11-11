import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateAutoTags, generateItemDescription } from "./ai";
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

describe("generateItemDescription", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "owner" } });
    mocks.create.mockResolvedValue({
      status: "completed",
      output_text: '{"description":"  Configures server-side rendering. Use it for dynamic pages.  "}',
    });
  });

  it.each([
    { type: "snippet", content: "export const dynamic = 'force-dynamic';", language: "TypeScript" },
    { type: "command", content: "npm run build" },
    { type: "prompt", content: "Summarize the release notes" },
    { type: "note", tags: "React, SSR" },
    { type: "link", url: "https://example.com/guide" },
    { type: "file", fileName: "guide.pdf", fileMimeType: "application/pdf" },
    { type: "image", fileName: "layout.png", fileMimeType: "image/png" },
    { type: "note", title: "SSR guide" },
  ])("uses the available draft details for $type", async (input) => {
    await expect(generateItemDescription(input)).resolves.toEqual({
      success: true, data: "Configures server-side rendering. Use it for dynamic pages.",
    });
    expect(mocks.assertProAccess).toHaveBeenCalledWith(mocks.tx, "owner");
    expect(mocks.enforceAiRateLimit).toHaveBeenCalledWith("owner", mocks.tx);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      input: `Item JSON:\n${JSON.stringify(input)}`, store: false,
    }));
  });

  it("bounds draft text and removes URL credentials, query and fragment", async () => {
    await generateItemDescription({ type: "note", content: "a".repeat(3000), description: "b".repeat(3000) });
    await generateItemDescription({ type: "link", url: "https://user:pass@example.com/guide?token=secret#private" });
    expect(mocks.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      input: `Item JSON:\n${JSON.stringify({ type: "note", content: "a".repeat(2000), description: "b".repeat(2000) })}`,
    }));
    expect(mocks.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      input: 'Item JSON:\n{"type":"link","url":"https://example.com/guide"}',
    }));
  });

  it.each([{ type: "note", title: " " }, { type: "unknown", title: "SSR" }])("rejects an unusable draft", async (input) => {
    await expect(generateItemDescription(input)).resolves.toMatchObject({ success: false });
    expect(mocks.enforceAiRateLimit).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("requires sign-in, Pro access, and available quota before contacting the provider", async () => {
    const input = { type: "note", title: "SSR" };
    mocks.auth.mockResolvedValueOnce(null);
    await expect(generateItemDescription(input)).resolves.toMatchObject({ success: false, error: expect.stringMatching(/sign in/i) });
    expect(mocks.assertProAccess).not.toHaveBeenCalled();

    mocks.assertProAccess.mockRejectedValueOnce(new EntitlementError("PRO_REQUIRED"));
    await expect(generateItemDescription(input)).resolves.toMatchObject({ success: false, error: expect.stringContaining("Pro") });
    expect(mocks.enforceAiRateLimit).not.toHaveBeenCalled();

    mocks.enforceAiRateLimit.mockRejectedValueOnce(new AuthRateLimitError(60));
    await expect(generateItemDescription(input)).resolves.toMatchObject({ success: false, error: expect.stringContaining("Too many attempts") });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    ["completed", '{"description":""}'],
    ["completed", '{"description":"One sentence. Another sentence. A third sentence."}'],
    ["completed", "not JSON"],
    ["incomplete", '{"description":"Configures server-side rendering."}'],
  ])("rejects unusable provider output (%s, %s)", async (status, output_text) => {
    mocks.create.mockResolvedValue({ status, output_text });
    await expect(generateItemDescription({ type: "note", title: "SSR" })).resolves.toMatchObject({ success: false });
  });
});
