import { describe, expect, it, vi } from "vitest";
import { isEmailVerificationEnabled } from "@/lib/email-verification-config";

describe("isEmailVerificationEnabled", () => {
  it.each([undefined, "true", "FALSE", "", "0"])("enables verification for %s", (value) => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", value);
    expect(isEmailVerificationEnabled()).toBe(true);
  });

  it("disables verification only for the exact false value", () => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", "false");
    expect(isEmailVerificationEnabled()).toBe(false);
  });
});
