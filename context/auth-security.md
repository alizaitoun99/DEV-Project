# Authentication security

## Email identity

Emails are trimmed and lowercased through `normalizeEmail`. Credentials validation and registration use this policy. The Auth.js adapter applies it to OAuth user creation, email lookup, and updates. GitHub account linking retains Auth.js defaults; matching an email does not automatically link an untrusted OAuth account.

The `auth_identity_and_throttling` migration locks user writes briefly, checks for canonical-email collisions, normalizes existing addresses without changing user IDs, and adds a canonical-email check constraint. The existing unique email constraint then prevents duplicates across all writers, including concurrent requests. If collisions exist, the migration aborts; resolve ownership explicitly before retrying. Never automatically merge accounts or discard their data.

## Shared throttling

### Upstash sliding windows

Set server-only `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to enable the additional sliding-window limiter. Restart or redeploy after changing credentials. Without both variables, the Upstash layer allows requests; existing PostgreSQL limits below remain enforced. Upstash errors or a one-second timeout also allow requests through this layer. PostgreSQL failures still deny requests. No migration is required.

| Operation | Upstash budget | Key |
| --- | --- | --- |
| Credentials callback | 5 / 15 minutes | Trusted IP + normalized email |
| Registration | 3 / hour | Trusted IP |
| Forgot password | 3 / hour | Trusted IP |
| Reset password | 5 / 15 minutes | Trusted IP |
| Verification resend | 3 / 15 minutes | Trusted IP + authenticated account email |

The same `AUTH_TRUSTED_IP_HEADER` policy below applies. Use a proxy-overwritten, single-IP header. When that setting or a valid single IP is missing, the Redis check allows the request without contacting Redis; existing PostgreSQL shared/network and account limits continue to apply. Malformed values and forwarded lists also skip Redis. This avoids applying the small per-IP Redis budget to every visitor collectively. Do not enable an arbitrary client-controlled `x-forwarded-for` header. Redis keys are HMAC digests using `AUTH_SECRET`; operation prefixes isolate budgets. Existing account and network limits remain active, including the stricter three-per-hour verification resend safeguard.

The forms now use `/api/auth/forgot-password`, `/api/auth/reset-password`, and `/api/auth/resend-verification`. The existing combined `/api/auth/password-reset` and `/api/auth/verification` endpoints remain compatible and use the same enforcement functions and budgets, so switching URLs cannot bypass limits. Reset operation selection is based on the submitted token, as on the original combined endpoint.

Credentials checks run inside Auth.js `authorize`, covering direct callbacks and server-side sign-in. The callback route translates a rate-limit error into HTTP 429 with `Retry-After` while retaining the error URL consumed by the Auth.js client. Other auth flows also return 429 and retry seconds. Frontend toasts explain the remaining wait in rounded-up minutes. OAuth handlers remain unchanged.

Run `npm run test:rate-limit` for isolated key normalization, trusted-header handling, endpoint policy, Redis failure behavior, and Auth.js callback response metadata/cookie checks. Missing, malformed, and untrusted IP tests assert zero limiter calls for every operation. These tests do not contact Redis. The PostgreSQL authentication regression suite disables Upstash in its own process to avoid consuming live Redis budgets. With configured Upstash credentials, run `node --conditions=react-server --import tsx script/rate-limit-live.ts` to verify five allowed attempts followed by a denial using random test identities and a synthetic trusted IP configured only within that script. Redis test keys expire automatically; no users are created or saved environment files changed.

PostgreSQL stores atomic, fixed-window counters shared across app instances. Each attempt first consumes a network budget, then a normalized-email budget before user lookup or bcrypt work. Successful sign-ins also consume the budget; counters are not reset on success. Database time defines expiration, so app clock differences cannot bypass the limits.

| Operation | Account | Trusted IP | Shared fallback when no trusted IP is available |
| --- | --- | --- | --- |
| Credentials sign-in | 5 / 15 minutes | 30 / 15 minutes | 300 / 15 minutes |
| Registration | 3 / hour | 10 / hour | 50 / hour |

Registration returns HTTP 429 and `Retry-After` in seconds. Credentials uses Auth.js's `CredentialsSignin` redirect with `code=rate_limited`. Storage failure denies the operation; registration returns a generic 503. Throttling runs inside `authorize` as well as the registration handler, covering direct Auth.js callback requests and server-side sign-in calls.

Only set `AUTH_TRUSTED_IP_HEADER` when the reverse proxy overwrites that single-IP header and direct access to the origin is blocked. Arbitrary client-supplied forwarding headers are ignored by default. Missing, malformed, or multi-IP values use the shared fallback. Per-account limits remain active in both modes. The fallback intentionally shares a request budget across users; configure the trusted proxy header for a public deployment to avoid shared-budget contention.

Keys are HMAC-SHA256 digests using `AUTH_SECRET`; raw email addresses and IPs are not stored in the limiter. All instances must share the same secret. Rotating it starts fresh budgets. Counters saturate to avoid integer overflow. Each request removes at most 100 other counters expired for over a day, using the expiry index and skipping locked rows; inactive deployments retain expired counters until requests resume.

This uses the existing database to suit the application's current scale. Monitor database load, rejection rates, and shared-budget contention before adjusting thresholds. Apply production migrations with `npm run db:deploy` before starting the application; a missing limiter table fails closed.

## Registration email verification

Set server-only `EMAIL_VERIFICATION_ENABLED=false` in the root `.env.local` or deployment environment to disable verification emails and dashboard reminders, including for existing unverified accounts. Restart the server or redeploy after changing it. Only the exact string `false` disables verification; unset, empty, and other values preserve the enabled default. No Resend configuration is needed while disabled. Registration returns `verificationEnabled: false` and `verificationEmailSent: false`, creates no verification tokens, and shows no delivery warning. Auth validation, throttling, automatic sign-in, and dashboard access remain unchanged. Resend requests are rejected server-side before consuming the resend budget. Existing verification links remain usable with normal expiry and single-use validation.

Disabling verification never sets `emailVerified` or modifies existing tokens. After configuring a verified Resend sender domain and the delivery settings below, set `EMAIL_VERIFICATION_ENABLED=true` and restart/redeploy. Reminders and resend return for all unverified accounts. No migration is required.

Configure server-only `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (a verified Resend domain), and `APP_URL` (trusted public origin; local HTTP is accepted only for localhost/127.0.0.1). `AUTH_URL` is a fallback when `APP_URL` is absent. Verification uses Resend's REST API with a ten-second timeout. Never derive email links from the request Host header.

For local testing without an owned domain, use `RESEND_FROM_EMAIL="DevStash <onboarding@resend.dev>"` and register with the email address associated with the Resend account. Resend restricts this test sender to that recipient; production delivery to other users requires a verified sender domain. A Vercel `vercel.app` deployment URL can host verification links but does not provide sender-domain DNS control. Provider rejection status/code and missing configuration flags are logged server-side without credentials, recipients, or links.

Registration creates an unverified account, attempts email delivery, and returns `verificationEmailSent` independently of account creation. Delivery failure preserves the account and automatic sign-in; the UI explains how to retry. Dashboard access remains available. A persistent orange toast prompts unverified users and offers resend, limited to three requests per account per hour. The database verified state is refreshed on window focus and every minute while the reminder is mounted.

Links contain 32 random bytes, expire after 24 hours, and store only SHA-256 hashes in the existing `VerificationToken` table with a namespaced user/email identifier. No schema migration is required. Opening a link automatically sends a same-origin POST from the verification page, then redirects to the dashboard without a confirmation button. React effect replay reuses the in-flight request so a single-use token is submitted once. Users without a session are sent through the normal dashboard sign-in flow. Email scanners that execute JavaScript may consume links. Consumption and verification run in one transaction; changing the account email invalidates prior links, and successful verification removes sibling tokens. Expired tokens are cleaned up when that account requests another email. Delivery retries preserve older links in case a previous email arrived despite a delivery timeout. Resend responses and API credentials are never returned to the browser.

Run `npm run test:email-verification` for database-backed Node/tsx tests covering malformed/expired/replayed tokens, concurrent use, changed-email protection, delivery payloads, hashed storage, and delivery failures. Email sends are mocked; generated database fixtures are removed afterward. End-to-end inbox delivery must also be checked with a real recipient and verified sender.

## Password reset

The sign-in page links to `/forgot-password`; credentials users receive a link to `/reset-password`. Reset delivery uses the same Resend and application URL settings above, independently of `EMAIL_VERIFICATION_ENABLED`. Unknown and OAuth-only accounts receive the same response, including when delivery fails. Check server logs for the generic delivery failure diagnostic; no recipients, passwords, or tokens are logged. The existing Resend test-sender recipient restriction still applies.

Reset tokens use 32 random bytes, SHA-256 storage, a separate `password-reset:userId:email` identifier, and a 30-minute expiry in the existing `VerificationToken` model. Email verification tokens cannot reset passwords. Changing the email invalidates the link. A transaction compares the previous password hash, updates the password with bcrypt cost 12, consumes the unexpired token, and deletes sibling reset tokens. Concurrent links can change the password only once. Opening a link does not consume it; users must submit a valid, matching password. Success requires a fresh sign-in; existing JWT sessions retain their normal lifetime.

Same-origin POST requests are required. Reset email requests have a separate budget of three per normalized account per hour, ten per trusted IP per hour, or fifty per hour in the shared fallback. Reset submissions share the network budget. Rate limits return 429 with `Retry-After`; storage errors fail closed. No schema migration is required.

Account lookup and email delivery run through Next.js `after` once the generic response has been sent, keeping account existence and provider latency out of public response timing. The deployment must support Next.js post-response work and allow enough execution time for the ten-second provider timeout.

Run `npm run test:password-reset` for database-backed regression checks with mocked email delivery. Generated test accounts and tokens are removed afterward.

## Authentication regression checks

Run `npm run test:auth-security` against a configured development database. Tests use Node's built-in test runner and the existing `tsx` dependency. They verify concurrent enforcement, expiration, case-variant budget bypass prevention, storage failures, OAuth adapter normalization, duplicate rejection, the database constraint, and registration's 429/Retry-After response. User fixtures roll back or are removed by their generated ID; test-owned account counters are removed. Endpoint checks consume four attempts from the normal shared registration budget. No framework dependency is added.

Also run lint, TypeScript, and the production build. Browser/HTTP checks should cover registration throttling with `Retry-After`, case-variant duplicate registration, mixed-case credentials sign-in, and `rate_limited` credentials rejection. Full GitHub OAuth callback validation requires an interactive GitHub login.

## Profile account actions

The protected `/profile` page shows account details and owner-scoped item/collection counts, including zero counts for system types. Password accounts can change their password after supplying the current password. OAuth-only accounts cannot create a password through this action. New passwords use the shared validation rules and bcrypt cost 12; changing a password invalidates outstanding password-reset links. Existing JWT sessions retain their normal lifetime.

Account deletion requires the exact confirmation `DELETE`, plus the current password when one exists. Server Actions derive the owner from the session, validate inputs, and throttle each account action to five attempts per 15 minutes. The transaction removes verification/reset tokens and the user; database cascades remove owned content and authentication records. System item types and other users are preserved. Physical R2 object cleanup remains part of the future upload lifecycle; this feature deletes database records only.

Run `npm run test:profile` for the isolated database-backed profile regression test. It covers wrong passwords, confirmation validation, OAuth-only password rejection, password hashing, reset-link invalidation, cascading deletion, and preservation of another account. As with existing auth tests, it loads the test database configuration from `.env` via dotenv.
