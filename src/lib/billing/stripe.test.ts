import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingInterval } from "./stripe";

const { Stripe } = vi.hoisted(() => ({ Stripe: vi.fn(class Stripe {}) }));
vi.mock("stripe", () => ({ default: Stripe }));

beforeEach(() => {
  vi.resetModules();
  for (const name of [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_MONTHLY_ID",
    "STRIPE_PRICE_YEARLY_ID",
    "APP_URL",
    "AUTH_URL",
  ]) {
    vi.stubEnv(name, undefined);
  }
});

describe("Stripe configuration", () => {
  it("imports without credentials and creates the client once on demand", async () => {
    const { getStripeClient } = await import("./stripe");
    expect(Stripe).not.toHaveBeenCalled();
    expect(() => getStripeClient()).toThrow("STRIPE_SECRET_KEY");
    vi.stubEnv("STRIPE_SECRET_KEY", "pk_test_public");
    expect(() => getStripeClient()).toThrow("STRIPE_SECRET_KEY");
    expect(Stripe).not.toHaveBeenCalled();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example");
    expect(getStripeClient()).toBe(getStripeClient());
    expect(Stripe).toHaveBeenCalledExactlyOnceWith("sk_test_example");
  });

  it("validates the webhook secret independently of the client", async () => {
    const { getStripeWebhookSecret } = await import("./stripe");
    expect(getStripeWebhookSecret).toThrow("STRIPE_WEBHOOK_SECRET");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "sk_test_example");
    expect(getStripeWebhookSecret).toThrow("STRIPE_WEBHOOK_SECRET");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_example");
    expect(getStripeWebhookSecret()).toBe("whsec_example");
    expect(Stripe).not.toHaveBeenCalled();
  });

  it("maps only valid intervals to distinct configured prices", async () => {
    const { getStripePriceId } = await import("./stripe");
    expect(() => getStripePriceId("weekly" as BillingInterval)).toThrow("Invalid billing interval");
    expect(() => getStripePriceId("monthly")).toThrow("STRIPE_PRICE_MONTHLY_ID");
    vi.stubEnv("STRIPE_PRICE_MONTHLY_ID", "price_monthly");
    vi.stubEnv("STRIPE_PRICE_YEARLY_ID", "prod_invalid");
    expect(() => getStripePriceId("yearly")).toThrow("STRIPE_PRICE_YEARLY_ID");
    vi.stubEnv("STRIPE_PRICE_YEARLY_ID", "price_monthly");
    expect(() => getStripePriceId("monthly")).toThrow("must be distinct");
    vi.stubEnv("STRIPE_PRICE_YEARLY_ID", "price_yearly");
    expect(getStripePriceId("monthly")).toBe("price_monthly");
    expect(getStripePriceId("yearly")).toBe("price_yearly");
  });
});

describe("billing origin", () => {
  it("uses APP_URL first and falls back to AUTH_URL for local development", async () => {
    const { getBillingOrigin } = await import("./stripe");
    expect(getBillingOrigin).toThrow("APP_URL or AUTH_URL");
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    expect(getBillingOrigin()).toBe("http://localhost:3000");
    vi.stubEnv("APP_URL", "https://devstash.example/");
    expect(getBillingOrigin()).toBe("https://devstash.example");
  });

  it.each([
    "not a URL",
    "http://devstash.example",
    "https://devstash.example/settings",
    "https://devstash.example/?next=example",
    "https://devstash.example/#billing",
    "https://user:password@devstash.example",
  ])("rejects an invalid app origin %s", async (origin) => {
    vi.stubEnv("APP_URL", origin);
    vi.stubEnv("AUTH_URL", "https://fallback.example");
    const { getBillingOrigin } = await import("./stripe");
    expect(getBillingOrigin).toThrow("valid billing origin");
  });
});
