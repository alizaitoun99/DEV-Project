import { getStripeClient, getStripeWebhookSecret } from "@/lib/billing/stripe";
import { reconcileBillingEvent } from "@/lib/billing/webhooks";

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const signature = request.headers.get("Stripe-Signature");
  if (!signature) return new Response("Missing Stripe signature", { status: 400, headers });

  try {
    const stripe = getStripeClient();
    const secret = getStripeWebhookSecret();
    const body = Buffer.from(await request.arrayBuffer());
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret);
    } catch {
      return new Response("Invalid Stripe signature", { status: 400, headers });
    }
    await reconcileBillingEvent(event);
    return new Response(null, { status: 204, headers });
  } catch {
    console.error("Stripe webhook could not be processed. Delivery can be retried.");
    return new Response("Billing temporarily unavailable", { status: 503, headers });
  }
}
