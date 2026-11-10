import { z } from "zod";
import { consumeAuthLimit } from "@/lib/auth-rate-limit";
import { startCheckout } from "@/lib/billing/checkout";
import { billingPost, billingResponse } from "@/lib/billing/requests";
import { isCheckoutAvailable } from "@/lib/billing/stripe";

const requestSchema = z.strictObject({ interval: z.enum(["monthly", "yearly"]) });

export async function POST(request: Request) {
  return billingPost(request, async (ownerId) => {
    if (!isCheckoutAvailable()) return billingResponse({ error: "Checkout is currently unavailable." }, 503);
    const text = await request.text();
    if (text.length > 256) return billingResponse({ error: "Request too large." }, 413);
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      return billingResponse({ error: "Invalid Checkout request." }, 400);
    }
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) return billingResponse({ error: "Choose a monthly or yearly plan." }, 400);
    await consumeAuthLimit(`billing:checkout:${ownerId}`, 12, 60 * 10);
    return billingResponse(await startCheckout(ownerId, parsed.data.interval));
  });
}
