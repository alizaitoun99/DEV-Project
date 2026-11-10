import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ auth: vi.fn(), consume: vi.fn(), checkout: vi.fn() }));
vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/auth-rate-limit", () => ({
  consumeAuthLimit: m.consume,
  AuthRateLimitError: class extends Error {},
}));
vi.mock("./checkout", () => ({
  startCheckout: m.checkout,
  BillingPendingError: class extends Error {},
}));
import { POST } from "@/app/api/billing/checkout/route";

const origin = "https://devstash.example";
function request(body: object, requestOrigin = origin) {
  return new Request(`${origin}/api/billing/checkout`, {
    method: "POST", headers: { Origin: requestOrigin }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_URL", origin);
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example");
  vi.stubEnv("STRIPE_PRICE_MONTHLY_ID", "price_month");
  vi.stubEnv("STRIPE_PRICE_YEARLY_ID", "price_year");
  m.auth.mockResolvedValue({ user: { id: "owner" } });
  m.checkout.mockResolvedValue({ url: "https://checkout.stripe.com/session" });
});

it("rejects a foreign origin before reading the session", async () => {
  const response = await POST(request({ interval: "monthly" }, "https://other.example"));
  expect(response.status).toBe(403);
  expect(m.auth).not.toHaveBeenCalled();
  expect(m.checkout).not.toHaveBeenCalled();
});

it("requires a session and accepts only the interval", async () => {
  m.auth.mockResolvedValueOnce(null);
  expect((await POST(request({ interval: "monthly" }))).status).toBe(401);
  expect((await POST(request({ interval: "monthly", customerId: "cus_forged" }))).status).toBe(400);
  expect((await POST(request({ interval: "weekly" }))).status).toBe(400);
  expect(m.checkout).not.toHaveBeenCalled();
});

it("uses session ownership and disables response caching", async () => {
  const response = await POST(request({ interval: "yearly" }));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(m.consume).toHaveBeenCalledWith("billing:checkout:owner", 12, 600);
  expect(m.checkout).toHaveBeenCalledWith("owner", "yearly");
});
