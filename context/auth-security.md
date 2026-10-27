# Authentication security

## Email identity

Emails are trimmed and lowercased through `normalizeEmail`. Credentials validation and registration use this policy. The Auth.js adapter applies it to OAuth user creation, email lookup, and updates. GitHub account linking retains Auth.js defaults; matching an email does not automatically link an untrusted OAuth account.

The `auth_identity_and_throttling` migration locks user writes briefly, checks for canonical-email collisions, normalizes existing addresses without changing user IDs, and adds a canonical-email check constraint. The existing unique email constraint then prevents duplicates across all writers, including concurrent requests. If collisions exist, the migration aborts; resolve ownership explicitly before retrying. Never automatically merge accounts or discard their data.

## Shared throttling

PostgreSQL stores atomic, fixed-window counters shared across app instances. Each attempt first consumes a network budget, then a normalized-email budget before user lookup or bcrypt work. Successful sign-ins also consume the budget; counters are not reset on success. Database time defines expiration, so app clock differences cannot bypass the limits.

| Operation | Account | Trusted IP | Shared fallback when no trusted IP is available |
| --- | --- | --- | --- |
| Credentials sign-in | 5 / 15 minutes | 30 / 15 minutes | 300 / 15 minutes |
| Registration | 3 / hour | 10 / hour | 50 / hour |

Registration returns HTTP 429 and `Retry-After` in seconds. Credentials uses Auth.js's `CredentialsSignin` redirect with `code=rate_limited`. Storage failure denies the operation; registration returns a generic 503. Throttling runs inside `authorize` as well as the registration handler, covering direct Auth.js callback requests and server-side sign-in calls.

Only set `AUTH_TRUSTED_IP_HEADER` when the reverse proxy overwrites that single-IP header and direct access to the origin is blocked. Arbitrary client-supplied forwarding headers are ignored by default. Missing, malformed, or multi-IP values use the shared fallback. Per-account limits remain active in both modes. The fallback intentionally shares a request budget across users; configure the trusted proxy header for a public deployment to avoid shared-budget contention.

Keys are HMAC-SHA256 digests using `AUTH_SECRET`; raw email addresses and IPs are not stored in the limiter. All instances must share the same secret. Rotating it starts fresh budgets. Counters saturate to avoid integer overflow. Each request removes at most 100 other counters expired for over a day, using the expiry index and skipping locked rows; inactive deployments retain expired counters until requests resume.

This uses the existing database to suit the application's current scale. Monitor database load, rejection rates, and shared-budget contention before adjusting thresholds. Apply production migrations with `npm run db:deploy` before starting the application; a missing limiter table fails closed.

## Regression checks

Run `npm run test:auth-security` against a configured development database. Tests use Node's built-in test runner and the existing `tsx` dependency. They verify concurrent enforcement, expiration, case-variant budget bypass prevention, storage failures, OAuth adapter normalization, duplicate rejection, the database constraint, and registration's 429/Retry-After response. User fixtures roll back or are removed by their generated ID; test-owned account counters are removed. Endpoint checks consume four attempts from the normal shared registration budget. No framework dependency is added.

Also run lint, TypeScript, and the production build. Browser/HTTP checks should cover registration throttling with `Retry-After`, case-variant duplicate registration, mixed-case credentials sign-in, and `rate_limited` credentials rejection. Full GitHub OAuth callback validation requires an interactive GitHub login.
