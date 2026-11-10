# Stripe Integration Phase 1 — Core Infrastructure

## Overview

Prepare DevStash's Stripe configuration, billing persistence, and shared usage-limit checks. This phase is independently testable with mocked Stripe and Prisma dependencies. [Stripe integration plan](../../docs/stripe-integration-plan.md) · [Phase 2 spec](stripe-phase-2-spec.md)

## Requirements

### Stripe configuration

- Add the server-side `stripe` SDK and synchronize the npm lockfile. Implement a lazy, server-only client in `src/lib/billing/stripe.ts` so the application can build and run existing flows without billing credentials.
- Document `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY_ID`, `STRIPE_PRICE_YEARLY_ID`, and the existing `APP_URL` or `AUTH_URL` in `.env.example`. Validate configuration when the relevant billing operation is invoked and derive return URLs from a fixed, validated app origin.
- Map validated `monthly` and `yearly` intervals to distinct server-configured prices. DevStash Pro costs USD $8 monthly or $72 annually. Both intervals grant the same access.

### Billing persistence

- Reuse `User.plan`, the unique Stripe customer and subscription mappings, `subscriptionStatus`, and `currentPeriodEnd`. Add a billing revision, a uniquely keyed webhook receipt table, and durable checkout attempt state with one current attempt per owner. Store stable idempotency keys, request parameters, and provider IDs needed for recovery after a timeout or crash.
- Add a reviewed Prisma migration that preserves existing users, Stripe mappings, and the development seed's Pro account. Retain `FREE` as the default for new users. Keep authentication sessions identity-only and use the database plan for entitlement decisions.

### Usage limits

- Implement `src/lib/billing/usage-limits.ts` as the shared entitlement module. Define Free limits of 50 total owned items across all types and 3 owned collections. Count each item once regardless of collection membership. Pro bypasses the Free counts.
- Expose transaction-aware assertions for item and collection creation capacity and Pro-only operations. Use stable typed errors for missing accounts, item limits, collection limits, and Pro requirements.
- Acquire the owner row lock before reading the current plan and counting owned rows. Callers must hold that lock through the write in the same transaction. Phase 2 billing reconciliation must use the same lock so downgrades and gated writes have a defined order.
- Deliver these helpers without wiring them into existing write paths in this phase. Hosted Checkout, Customer Portal, webhook processing, and billing UI are Phase 2 work.

## Testing and acceptance

- [ ] Add colocated Vitest tests in `src/lib/billing/usage-limits.test.ts` using mocked transaction clients. Verify that Free users can create at 49 items and 2 collections, and receive the correct errors at and above 50 items and 3 collections.
- [ ] Verify that count queries are owner-scoped, plan lookup acquires the lock before counting, missing accounts fail before counting, and Pro skips the Free count queries. Verify Free denial and Pro access for a Pro-only operation.
- [ ] Test lazy configuration, missing or invalid settings, distinct price mapping, and fixed return origin with mocked configuration and Stripe. The unit suite requires no Stripe CLI, Stripe credentials, or live database.
- [ ] Apply the migration to a development database with existing records, verify that records and plan values are preserved, and check Prisma migration status. Mocked tests cover helper behavior. Phase 2 verifies competing writes on PostgreSQL.
- [ ] Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Verify the build can run without Stripe configuration.
