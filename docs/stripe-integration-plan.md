# DevStash Pro Stripe integration plan

Research date: 2026-11-10. Scope: hosted Checkout, Customer Portal, Stripe-to-Neon entitlement sync, and server-side limits. DevStash Pro costs USD $8 monthly or $72 annually. The annual price bills $72 at once and saves $24 per year. Both prices grant the same features.

## Current codebase

| Area | Confirmed behavior |
|---|---|
| User schema | [Prisma schema](../prisma/schema.prisma) has `plan: Plan @default(FREE)`, nullable unique `stripeCustomerId` and `stripeSubscriptionId`, and nullable `subscriptionStatus` and `currentPeriodEnd`. The enum is `FREE / PRO`. There is no `isPro` column. The [development seed](../prisma/seed.ts) explicitly sets its demo user to Pro without Stripe. |
| Auth | [Full Auth.js config](../src/auth.ts) uses GitHub OAuth, bcrypt credentials, the Prisma adapter, and JWT sessions. The session callback exposes the user ID from `token.sub`. The [session types](../src/types/next-auth.d.ts) add only the ID. [Proxy](../src/proxy.ts) uses the separate database-free [config](../src/auth.config.ts) for protected-page redirects, including Settings. |
| Server access | [Current-user helper](../src/lib/current-user.ts) resolves the authenticated user and selects the database plan with React request memoization. Dashboard UI can pass that plan to [UserMenu](../src/components/auth/UserMenu.tsx). Actions and API routes typically resolve `auth()`, take the owner ID from the session, and call an owner-scoped data function. An authenticated cookie can outlive a deleted row, so billing and quota mutations must also require an existing user. |
| Payments | [Homepage pricing](../src/components/homepage/PricingComparison.tsx) shows both prices and toggles the display period. [The homepage](../src/app/page.tsx) supplies a workspace/account CTA. No Stripe SDK, Checkout/Portal route, webhook consumer, or payment flow was found. |
| Settings | [Settings](../src/app/settings/page.tsx) is a protected Server Component with a Suspense boundary, current-user lookup, editor preferences, and [account/security actions](../src/components/auth/ProfileActions.tsx). Profile shows identity and usage separately. Settings is the natural home for billing. |
| Route and error conventions | [Collections POST](../src/app/api/collections/route.ts) checks origin, authenticates, caps and validates the request with Zod, and returns private, no-store JSON. [Uploads POST](../src/app/api/uploads/route.ts) dispatches begin, finish, and abandon with typed storage/rate-limit errors. [Item actions](../src/actions/items.ts) return discriminated success/error objects, with validation messages and generic unexpected-error responses. |
| Environment | Existing integrations read server variables through `process.env`. [Email verification](../src/lib/email-verification.ts) uses `APP_URL ?? AUTH_URL` for links. [Supabase storage](../src/lib/supabase-storage.ts) keeps credentials in a server-only module. Follow those patterns and list names and placeholders in [the env example](../.env.example). |

## Product rules and enforcement points

The [project overview](../context/project-overview.md#9-subscription-and-access-policy) defines 50 total items and 3 collections for Free. Count owned rows across all types, including existing files and images. Membership in multiple collections consumes one item slot. Pagination and the existing [item](../src/lib/db/items.ts) and [collection](../src/lib/db/collections.ts) stats are display reads. They provide query patterns for quotas.

| Capability | Implementation point |
|---|---|
| Text and link creation | Enforce the 50-item cap inside the transaction in `src/lib/db/items.ts:createItem` before insertion. Keep existing type and collection ownership validation. Future import, duplication, and bulk creation must use the same quota contract. |
| Collection creation | Wrap `src/lib/db/collections.ts:createCollection` in a transaction and enforce the 3-collection cap before insertion. Return a stable quota code from POST `/api/collections` so the dialog can link to Billing. |
| Files and images | Require Pro before issuing a signed upload and again in the finalization transaction. Recheck under the owner lock, since downgrade can happen during a transfer. Route denied finalizations through the durable storage ledger so abandoned bytes are eventually cleaned. Keep existing file size, type, outstanding-upload and owner checks. Keep existing download and thumbnail access on downgrade under the proposed retention policy. |
| AI | The homepage preview does not represent a live AI feature. Gate future tagging, summarizing, explanations and prompt optimization before the provider call, with separate usage limits and rate limits. |
| Custom types | The schema supports owned types. Gate future custom-type mutations when the feature ships, including use of a custom type to create new items. Existing items should remain readable after downgrade. |
| Export | No export endpoint was found. The overview leaves Free export open and recommends allowing basic JSON. Proposed split: basic owner-scoped JSON for everyone and ZIP/assets for Pro. Confirm before implementing any export gate. |

**Proposed downgrade behavior.** Keep all existing data readable. Preserve deletion and collection removal so users can return within quota. Treat the over-limit resource category as read-only for ordinary edits while its count is above the limit, in line with the project overview. Keep existing paid-only assets readable and downloadable and block new paid-only operations. At exactly 50 or 3, allow edits and block additional creation. Apply these rules consistently to edits, favorites, pins, and membership changes, including changes from either side of the item–collection relation. Confirm the precise read-only scope before enforcement.

**Concurrency.** In short Prisma transactions, acquire the same user row lock before reading the plan, counting, and inserting. Use that lock for billing projection writes so a creation and downgrade have a defined order. File mutations already use `lockStorageOwner`. For operations requiring both locks, acquire them in one consistent order across upload and account deletion. Keep Stripe network calls outside quota and storage transactions. Test the final slot against concurrent requests on PostgreSQL.

```ts
// Excerpt for src/lib/billing/entitlements.ts. Call inside the write transaction.
export async function assertItemCapacity(tx: Prisma.TransactionClient, userId: string) {
  const [user] = await tx.$queryRaw<{ plan: "FREE" | "PRO" }[]>`
    SELECT "plan" FROM "User" WHERE "id" = ${userId} FOR UPDATE
  `;
  if (!user) throw new EntitlementError("ACCOUNT_MISSING");

  if (user.plan === "FREE") {
    const count = await tx.item.count({ where: { userId } });
    if (count >= FREE_ITEM_LIMIT) throw new EntitlementError("ITEM_LIMIT");
  }
}
```

## Checkout and Customer Portal

### Files to create

| File | Responsibility |
|---|---|
| `src/lib/billing/stripe.ts` | Lazy server-only Stripe client and validated configuration. Map `monthly / yearly` to the two configured price IDs. Use a fixed, validated app origin for return URLs. |
| `src/lib/billing/checkout.ts` | Get or create a Stripe Customer from the authenticated user, coordinate checkout attempts, and create or reuse a hosted Session. |
| `src/app/api/billing/checkout/route.ts` | Authenticated same-origin POST with a small Zod body containing just the billing interval. Return a hosted redirect URL using private, no-store JSON. |
| `src/app/api/billing/portal/route.ts` | Authenticated same-origin POST. Look up the user's stored customer ID and create a fresh Portal session with a fixed Settings return URL. No customer ID or return URL from the request body. |
| `src/components/billing/BillingActions.tsx` | Pending/error states, monthly and annual CTAs, Manage billing, and bounded post-Checkout refresh while confirmation is pending. |
| `src/lib/billing/entitlements.ts` | Shared Free limits, typed errors, owner-lock helpers and paid-feature checks. |
| `src/lib/billing/reconcile.ts` and `src/app/api/stripe/webhook/route.ts` | Verify and dispatch signed Stripe events and atomically reconcile the local billing projection. |
| `prisma/migrations/<timestamp>_stripe_billing/` | Add webhook receipts, a reconciliation revision and durable checkout attempt state. Reuse the existing User billing fields. |
| `src/lib/billing/*.test.ts` | Mocked Vitest coverage for configuration, route handlers, status mapping, checkout recovery, and entitlements. |

### Checkout flow

1. Read a fresh user record by session ID. Validate the interval, rate-limit by user, and reject accounts being deleted. Resolve the configured Stripe price server-side. Authenticated route responses can use 400 for invalid input, 401 for missing identity, 403 for wrong origin, 409 for an existing subscription or conflicting attempt, 429 with `Retry-After`, and a generic retryable error for provider failures.
2. Create or reuse one Stripe Customer per owner. Persist the mapping before creating Checkout so subscription events can find the owner even if delivered first. Email is optional customer contact data. Email matching must never attach Stripe ownership.
3. Reserve one durable checkout attempt per user and persist its stable Stripe idempotency key and request parameters before calling Stripe. Reuse the same open Session for repeated clicks on the same interval. For a different interval, expire the old Session and confirm it did not complete before opening another. Reuse the key after an ambiguous timeout within Stripe's idempotency window. Reconcile Stripe's state before retrying after that window. Apply the same retry discipline to Customer creation.
4. Before Checkout, inspect current Stripe subscriptions for the stored Customer. Route customers with a manageable subscription to the Portal, including those with delinquent billing or an incomplete subscription needing resolution. Handle a completed Session awaiting webhook processing as pending. Dashboard duplicate-subscription protection is a second check alongside the application flow. [Existing customers](https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted), [duplicate subscriptions](https://docs.stripe.com/payments/checkout/limit-subscriptions), [idempotency](https://docs.stripe.com/api/idempotent_requests).
5. After Checkout, return to Settings. Show pending confirmation while the database still says Free. If using the Session ID for status UX, retrieve it server-side and verify it belongs to the signed-in user's Stripe Customer before rendering anything based on it. Use bounded `router.refresh()` attempts and a manual retry once the bound is reached. A successful redirect and a client session refresh never grant entitlement.

```ts
// Excerpt after owner validation, customer resolution, and attempt reservation.
const checkout = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer: stripeCustomerId,
  line_items: [{ price: priceByInterval[attempt.interval], quantity: 1 }],
  client_reference_id: userId,
  subscription_data: { metadata: { devstashUserId: userId } },
  success_url: `${appOrigin}/settings?billing=returned&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${appOrigin}/settings?billing=canceled`,
}, { idempotencyKey: attempt.idempotencyKey });

// Portal route, after looking up the authenticated owner's stored mapping.
const portal = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: `${appOrigin}/settings`,
});
```

Render only the necessary plan, status, and date information in Settings. Keep Stripe IDs, secrets, and hosted session URLs out of analytics and general client props. Show Manage billing even after a user loses Pro if a customer mapping still exists, so the user can recover payment or see invoices. [Customer Portal API integration](https://docs.stripe.com/customer-management/integrate-customer-portal).

## Webhooks and entitlement reconciliation

### Event handling

| Events | Action |
|---|---|
| `checkout.session.completed` | For subscription Checkout, verify the known Customer mapping, resolve the attempt and reconcile current subscription state. |
| `checkout.session.expired` | Resolve the matching attempt, allowing a fresh Checkout. Do not alter plan based on expiration. |
| `customer.subscription.created`, `.updated`, `.deleted`, `.paused`, `.resumed` | Reconcile the mapped customer's current qualifying subscription state. |
| `invoice.paid`, `invoice.payment_failed` | Reconcile state for subscription invoices and surface payment issues through Settings and Stripe's configured billing notices. |
| `checkout.session.async_payment_succeeded`, `.async_payment_failed` | Add before enabling delayed methods. Reconcile and update pending/failure UI. Start with card payments for the initial rollout. |

Use the raw body and the `Stripe-Signature` header in a Node.js Route Handler. No browser session or origin check is required for Stripe delivery. Invalid signatures return 400. After verification, acknowledge ignored events and committed work with 2xx. Return a retryable failure for transient Stripe or database errors. Keep synchronous handling bounded and alert on retry exhaustion. [Stripe webhooks](https://docs.stripe.com/webhooks), [subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks).

```ts
// src/app/api/stripe/webhook/route.ts (illustrative)
export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response(null, { status: 400 });

  const { stripe, webhookSecret } = getStripeConfig();
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return new Response(null, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
    return new Response(null, { status: 204 });
  } catch {
    console.error("Stripe webhook reconciliation failed", { eventId: event.id, type: event.type });
    return new Response(null, { status: 503 });
  }
}
```

### Projection and failure recovery

- Resolve ownership using the stored Stripe Customer ID, with metadata as a diagnostic cross-check. Check event mode against environment and enforce the configured DevStash prices. Ignore unrelated customers and products. Alert on identity conflicts or ambiguous managed subscriptions. Never change a different user's plan by matching email.
- Treat event payloads as notifications. Fetch the customer's current subscription state from Stripe, paging as needed. This handles a delayed deletion from an older subscription after a replacement exists. Use a single configured Pro subscription item with quantity one. Detect and alert on duplicates rather than granting additional entitlements. Use the current period end on the matching **subscription item** with Basil or later and convert Unix seconds to a database timestamp. Keep SDK and webhook API versions aligned and test representative payloads. [Stripe item-level billing periods](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end).
- Proposed status policy: `active` grants Pro for a recognized price. `trialing` grants Pro only if DevStash deliberately enables trials. Keep Pro during scheduled cancellation while the subscription stays active. Default to Free for `incomplete`, `incomplete_expired`, `past_due`, `unpaid`, `paused`, `canceled`, missing or unknown statuses. Confirm whether to give a `past_due` grace period before launch and coordinate it with Stripe's retry policy. Keep `subscriptionStatus` independent of the projected `plan`. Persist a nullable price ID and scheduled-cancellation indicator if showing interval and cancellation date in Settings.
- Insert the unique Stripe event receipt and update the user projection and checkout attempt in one transaction. A rolled-back projection must leave the event retryable. Distinct event IDs can represent the same change, so projection writes must be safe to repeat. Store IDs and minimal operational metadata, with a retention policy.
- Prevent concurrent stale writes by capturing the user's billing revision **before** reading Stripe. Commit with a conditional revision increment after locking the user row. If a competing reconciliation advanced the revision, discard the fetched state and read Stripe again. After bounded contention retries, return a retryable failure. Do not order subscription updates by event timestamps or overwrite the stored subscription ID from a stale snapshot.
- Reuse reconciliation in a protected operator repair command that accepts a known customer ID and defaults to preview. Include a runbook for retrying failed deliveries, resolving unmapped or duplicate subscriptions, and comparing Stripe state with local plan. Preserve an intentional development seed override for users without Stripe IDs. Check for manual Pro users before production rollout and decide whether to preserve any explicitly.

## Changes to existing files

- **`package.json`, `package-lock.json`, `.env.example`** — add the server-side `stripe` SDK and document `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY_ID`, `STRIPE_PRICE_YEARLY_ID`, and the existing `APP_URL` or `AUTH_URL`. Validate the two distinct configured prices against USD, their billing interval and amount before launch. Keep sandbox and live values separate. Hosted redirect flows need no browser key. Resolve configuration lazily so a local build without billing configuration can still run.
- **`prisma/schema.prisma`** — reuse existing plan and subscription columns. Add a billing revision, the unique event receipt table, and a per-owner attempt record. Capture Stripe request parameters and IDs needed for crash recovery. Add optional price/cancellation fields as needed for Settings.
- **`src/app/settings/page.tsx`** — render a Billing section inside the existing protected Server Component, with a fresh owner-scoped projection read, actionable checkout/portal errors, and separate canceled and pending return states. Keep editor preferences and account actions.
- **`src/app/page.tsx` and `src/components/homepage/PricingComparison.tsx`** — send signed-in users to Billing and preserve the selected period as a validated preselection. Keep the guest registration path. If carrying the choice through authentication, use a validated local destination. Require an explicit Checkout click in Settings.
- **`src/lib/db/items.ts`, `src/lib/db/collections.ts`, `src/lib/storage-uploads.ts`, `src/actions/items.ts`, and the collection/upload routes and dialogs** — enforce quotas at the write boundary and gate both upload phases. Translate entitlement failures into typed results or private JSON with stable codes and actionable copy. Keep cleanup operations available. Review edit, pin, favorite, and membership paths against the confirmed downgrade policy.
- **`src/lib/profile-account.ts` and `src/components/auth/ProfileActions.tsx`** — account deletion currently removes the database ownership mapping without touching Stripe. Before enabling Checkout, implement a durable deletion flow or block self-service deletion until the user resolves billing through the Portal. Under the block approach, fence Checkout during deletion, expire any outstanding session and confirm from Stripe that no billable or recoverable subscription exists before deleting the user. Scheduled cancellation can still renew if reversed, so keep the mapping until the subscription is terminal. If Stripe is unavailable, keep the account and offer retry. Include the same safeguards in production administrative deletion paths.
- **Auth files** — retain the existing identity-only JWT/session and read `User.plan` through the current-user query for display and from the write transaction for authorization. The prompt's proposed every-validation JWT refresh would require translating `isPro` from `plan`, adds a DB query to each full auth read, and makes auth more dependent on database availability. `trigger === "update"` responds to a client request, whereas Stripe updates the DB asynchronously. The existing server read makes both callbacks unnecessary for billing. A new render after the webhook commits reads the current plan. Preserve the database-free proxy configuration. [Auth.js callback reference](https://authjs.dev/reference/nextjs).

## Stripe Dashboard setup

1. In a sandbox, create one **DevStash Pro** product with two recurring USD prices, $8 every month and $72 every year. Copy the two price IDs. Start with cards and no trial. Choose the business's tax, invoice, and billing communication settings before accepting live payments.
2. Configure Customer Portal for payment method updates, invoice history, and cancellation at period end. Keep Portal subscription updates disabled. Enable Stripe's one-subscription Checkout setting if using its required Portal configuration. [Customer Portal](https://docs.stripe.com/customer-management/integrate-customer-portal), [duplicate subscription settings](https://docs.stripe.com/payments/checkout/limit-subscriptions).
3. In Workbench, register a public HTTPS destination for `/api/stripe/webhook` and select the event types listed above. Set the endpoint signing secret in the same environment as the Stripe API key and price IDs. For local forwarding use the CLI listener's own signing secret. [Webhook registration and CLI](https://docs.stripe.com/webhooks).
4. Before live launch, activate the account and repeat catalog, Portal and event destination setup in live mode. Apply Prisma migrations first. Verify environment isolation, alerting on delivery failures and a controlled live end-to-end smoke test before exposing the upgrade CTA.

## Validation checklist

- [ ] Mocked Vitest covers missing account, wrong origin, malformed period, forged Stripe identifiers, Stripe errors, Checkout and Portal ownership, duplicate attempts, and retry after an ambiguous response.
- [ ] Webhook tests cover exact raw body verification, invalid signature, duplicate IDs, rollback then retry, same-second/out-of-order events, stale revision conflict, old subscription deletion after replacement, unknown prices, wrong mode, and delayed delivery after account deletion.
- [ ] Database integration covers one customer per account, competing intervals and two simultaneous checkouts, a checkout racing deletion, and concurrent creation at the 49-item and 2-collection boundaries. Verify a downgrade mid-upload blocks finalization and leaves cleanup recoverable.
- [ ] Stripe sandbox browser runs cover both prices, abandoned/canceled Checkout, payment failure, webhook delayed past the return page, repeated refresh, Portal payment update, cancellation reversal, renewal and terminal cancellation. Use test clocks where supported and Stripe CLI forwarding for local delivery. Use real sandbox Checkout for owner-mapping tests since synthetic events may refer to unrelated fixtures. [Stripe Billing testing](https://docs.stripe.com/billing/testing).
- [ ] Check 49→50 items and 2→3 collections, failure at the next create, recovery after deletion, grandfathered assets, Pro bypass of Free counts, and unauthorized access to another owner's data. Confirm pending and failure UI on desktop and mobile.
- [ ] Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and Prisma migration status for the target environment. Follow [repository testing guidelines](testing.md).

## Implementation order

1. Confirm past-due access, downgrade edit scope, export split, and account deletion policy. Prepare the sandbox catalog and verify the selected SDK/API version.
2. Apply the billing migration in development. Implement and test Stripe configuration, checkout reservation, signature verification, reconciliation, and operator replay.
3. Implement deletion safeguards, then wire Checkout and Portal to Settings. Verify Stripe deliveries and browser return behavior in the sandbox.
4. Add transactional quotas and upload gates, with typed UI errors. Test downgrades against existing data and concurrency at each quota boundary.
5. Connect the homepage upgrade path, complete sandbox validation and live setup, and expose billing once entitlements, reconciliation and deletion safeguards are ready.

### Delivery and projection recovery

1. Confirm the database environment and the Stripe sandbox or live mode. Check the webhook delivery record in Stripe and verify that the destination uses the signing secret for that endpoint. For local forwarding, run `stripe listen --forward-to localhost:3000/api/stripe/webhook` using the sandbox account. Set `STRIPE_WEBHOOK_SECRET` to the listener's secret and start the app with the matching local `APP_URL`.
2. Fix the delivery or configuration issue and resend the original event from Stripe. A successful response means it was already processed, ignored, or committed. A retryable response leaves the receipt uncommitted. Compare the current subscription and the owner’s Settings plan after redelivery.
3. If redelivery is unavailable or the database projection needs repair, run `npm run billing:reconcile -- <userId>` against the intended environment. Review the projected plan, status, and proposed checkout-attempt resolution. Add `--execute` only after confirming the preview. The command reads Stripe again and rejects a concurrent billing revision change.
4. If a customer creation response was lost, retry Checkout. After the replay window, DevStash restores a uniquely identified customer mapping when possible and retires the attempt under the owner lock. Once session parameters have been saved, an uncertain session outcome still requires reconciliation. Use the stored idempotency key and metadata to investigate in Stripe. Resolve outstanding sessions and recoverable subscriptions before clearing a session attempt or deleting an owner.
5. Set `STRIPE_PORTAL_CONFIGURATION_ID` to a dedicated DevStash configuration or use the account default. Enable payment method updates, invoice history, and cancellation at period end. Keep subscription updates disabled and leave `STRIPE_LIVE_CHECKOUT_ENABLED` unset until live readiness and the controlled smoke-test procedure have been approved. [Stripe Portal configuration](https://docs.stripe.com/api/customer_portal/configurations/create)

This plan was derived from the repository and official documentation. Live database and Stripe operations were outside this research pass. The code excerpts describe the proposed implementation.
