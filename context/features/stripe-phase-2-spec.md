# Stripe Integration Phase 2 — Integration and UI

## Overview

Build hosted Checkout and Customer Portal flows, synchronize subscription state through signed webhooks, and enforce the resulting entitlements in DevStash. This phase depends on the Phase 1 migration, Stripe configuration, and usage-limit module. [Phase 1 spec](stripe-phase-1-spec.md) · [Stripe integration plan](../../docs/stripe-integration-plan.md)

## Requirements

### Checkout, Portal, and account deletion

- Add authenticated, same-origin POST routes at `/api/billing/checkout` and `/api/billing/portal` with private, no-store responses. Derive ownership from the session and a fresh user record. Validate and rate-limit Checkout by owner. Accept only the billing interval from the Checkout request and derive Stripe IDs and return URLs server-side.
- Persist one customer mapping per owner before creating Checkout. Use durable idempotency keys for customer and session creation. Reuse open sessions for repeated clicks on the same interval. If a user changes their selection before subscribing, confirm that the old session expired without completing before opening another. Recover lost customer creation responses and reconcile ambiguous session outcomes before starting a new attempt.
- Send customers with a manageable subscription to the Portal and treat completed Checkout awaiting reconciliation as pending. Use the stored customer mapping for Portal access, including after a downgrade.
- Implement the chosen account-deletion safeguards before enabling Checkout. Fence Checkout against deletion and preserve the ownership mapping until outstanding sessions and billable or recoverable subscriptions are resolved. Cover self-service and production administrative deletion. On Stripe failure, retain the account and make deletion retryable.

### Webhook reconciliation

- Add a Node.js handler at `/api/stripe/webhook` that verifies the raw body and `Stripe-Signature`. Return 400 for invalid signatures, 2xx for ignored or committed events, and a retryable error for transient failures.
- Handle Checkout completion and expiration, subscription creation, updates, deletion, pause and resume, and subscription invoice payment success and failure. Resolve expired attempts without changing access. Start with cards and no trial. Add asynchronous payment events before enabling delayed methods.
- Resolve owners by stored customer ID and fetch current Stripe state before projecting it. Filter by environment and configured prices, use the matching subscription item's period end, and flag ambiguous subscriptions. Grant Pro for a qualifying active subscription, including scheduled cancellation while it remains active. Apply the agreed delinquency policy and project Free when no qualifying subscription remains.
- Atomically record the unique event receipt, update the billing projection, and resolve the related checkout attempt. Use the shared owner lock and revision check to prevent stale overwrites. Retry reconciliation from a fresh Stripe read after revision conflicts. Preserve retryability on rollback and provide a preview-first operator repair command and delivery recovery runbook.

### Server-side feature gating

- Enforce Free creation limits in the item and collection write transactions using Phase 1's helpers. Check Pro before issuing file or image upload credentials and again in the finalization transaction. Route denied finalizations through the storage cleanup ledger and keep storage and billing lock order consistent.
- Preserve access to existing data and downloads on downgrade. Keep deletion and collection removal available so users can return within quota. Confirm the over-limit edit policy for edits, favorites, pins, and membership changes before wiring those gates. Allow ordinary edits at the limit and block additional creation.
- Surface stable entitlement codes from actions and routes, with upgrade or quota-recovery guidance in the relevant dialogs. Apply the shared Pro guard to future AI, custom type, and paid export entry points when those features ship.

### Billing UI

- Add a Billing section to protected Settings with a fresh owner-scoped plan read, monthly and annual upgrade actions, Manage billing, and payment or cancellation status. Keep existing Settings sections available.
- Show distinct canceled, pending, confirmed, and failure states. On Checkout return, use bounded refreshes with a manual retry option while the database still shows Free. Verify ownership of any returned session ID used for display. The database projection determines access.
- Send signed-in users from homepage pricing to Billing with a validated interval preselection. Preserve guest registration and require an explicit Checkout action in Settings. Keep secrets and provider identifiers out of general client props and analytics.

## Testing and acceptance

- [ ] Confirm the past-due grace policy, downgrade edit scope, and account-deletion approach before enabling billing. Confirm the export split before implementing any export gate.
- [ ] Add mocked Vitest coverage for billing utilities and changed Server Actions. Cover ownership, invalid input and origin checks, duplicate attempts, ambiguous Stripe responses, signature verification, rollback and retry, wrong-mode and unknown-price events, out-of-order events, and stale revision conflicts. Exercise Route Handlers through integration checks.
- [ ] Verify on PostgreSQL that competing requests can claim the last item or collection slot only once. Test Pro bypass, quota recovery after deletion, a downgrade during upload, duplicate checkout prevention, and a checkout racing account deletion.
- [ ] Configure sandbox prices and Portal settings. Use Stripe CLI forwarding to `/api/stripe/webhook` with the listener's signing secret. Complete real sandbox Checkout for both prices and confirm that signed webhook delivery updates the correct owner and unlocks gated operations. Use real sandbox Checkout for owner-mapping checks.
- [ ] With CLI forwarding, verify delayed delivery, duplicate or retried delivery, payment failure and recovery, renewal, scheduled cancellation and reversal, and terminal cancellation. Check canceled and abandoned Checkout, pending refresh, and upgrade and downgrade behavior in Settings and gated dialogs on desktop and mobile.
- [ ] Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Check Prisma migration status in the target environment. Before exposing live upgrade actions, complete the plan's live setup, alerting, and controlled smoke test. [Stripe integration plan](../../docs/stripe-integration-plan.md#stripe-dashboard-setup) · [Repository testing guidelines](../../docs/testing.md)
