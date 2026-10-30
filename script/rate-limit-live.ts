import env from "@next/env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

env.loadEnvConfig(process.cwd());
const { checkRateLimit } = await import("../src/lib/rate-limit");
assert.ok(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN, "Configure Upstash before running the live check.");
const email = `rate-limit-check-${randomUUID()}@example.com`;
// Exercise a synthetic trusted proxy in this script's process only.
process.env.AUTH_TRUSTED_IP_HEADER = "x-rate-limit-test-ip";
const request = new Request("http://localhost:3000/api/auth/callback/credentials", {
  headers: { "x-rate-limit-test-ip": "192.0.2.1" },
});
for (let attempt = 1; attempt <= 6; attempt++) {
  const result = await checkRateLimit("signin", request, attempt % 2 ? email.toUpperCase() : email);
  assert.equal(result.success, attempt <= 5, `Unexpected result for attempt ${attempt}`);
  if (attempt === 6) assert.ok(result.reset > Date.now());
}
assert.equal((await checkRateLimit("signin", request, `other-${email}`)).success, true);
console.log("Live Upstash check passed: five attempts allowed, sixth denied, case variants share a budget, other identities remain independent. Test keys expire automatically.");
