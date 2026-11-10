import "server-only";

import { auth } from "@/auth";
import { AuthRateLimitError } from "@/lib/auth-rate-limit";
import { BillingPendingError } from "./checkout";
import { getBillingOrigin } from "./stripe";

const headers = { "Cache-Control": "private, no-store" };

export function billingResponse(body: object, status = 200) {
  return Response.json(body, { status, headers });
}

export async function billingPost(request: Request, action: (ownerId: string) => Promise<Response>) {
  try {
    if (request.headers.get("Origin") !== getBillingOrigin()) {
      return billingResponse({ error: "Invalid request origin." }, 403);
    }
    const ownerId = (await auth())?.user.id;
    if (!ownerId) return billingResponse({ error: "Please sign in again." }, 401);
    return await action(ownerId);
  } catch (error) {
    if (error instanceof AuthRateLimitError) {
      return Response.json({ error: error.message }, {
        status: 429, headers: { ...headers, "Retry-After": String(error.retryAfter) },
      });
    }
    if (error instanceof BillingPendingError) {
      return billingResponse({ code: "BILLING_PENDING", error: error.message }, 409);
    }
    console.error("Stripe billing request could not be completed.");
    return billingResponse({ error: "Billing is temporarily unavailable. Please try again." }, 503);
  }
}
