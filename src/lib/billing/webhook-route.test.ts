import Stripe from "stripe";
import { beforeEach, expect, it, vi } from "vitest";

const reconcile = vi.hoisted(() => vi.fn());
vi.mock("./webhooks", () => ({ reconcileBillingEvent: reconcile }));
import { POST } from "@/app/api/stripe/webhook/route";

const secret = "whsec_example";
const payload = '{ "id": "evt_valid", "type": "customer.subscription.updated", "livemode": false }';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
});

function request(body: string, signedBody: string = body) {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "Stripe-Signature": Stripe.webhooks.generateTestHeaderString({ payload: signedBody, secret }) },
    body,
  });
}

it("verifies exact request bytes before reconciliation", async () => {
  expect((await POST(request(payload))).status).toBe(204);
  expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({ id: "evt_valid" }));
  reconcile.mockClear();
  expect((await POST(request(payload.trim().replaceAll(" ", ""), payload))).status).toBe(400);
  expect(reconcile).not.toHaveBeenCalled();
});

it("returns a retryable response when the database transaction fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  reconcile.mockRejectedValueOnce(new Error("rollback"));
  expect((await POST(request(payload))).status).toBe(503);
  expect((await POST(request(payload))).status).toBe(204);
});
