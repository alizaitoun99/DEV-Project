import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import { AUTH_LIMITS, authRateLimitResponse, checkRateLimit, rateLimitKey, rateLimitResponse } from "../src/lib/rate-limit";
import { AuthRateLimitError } from "../src/lib/auth-rate-limit";

test("trusted IP keys normalize email and isolate IPs and operations", async () => {
  const previous = process.env.AUTH_TRUSTED_IP_HEADER;
  try {
    process.env.AUTH_TRUSTED_IP_HEADER = "x-forwarded-for";
    const first = new Request("https://example.com", { headers: { "x-forwarded-for": "192.0.2.1" } });
    const second = new Request("https://example.com", { headers: { "x-forwarded-for": "192.0.2.2" } });
    assert.equal(rateLimitKey("signin", first, " User@Example.com "), rateLimitKey("signin", first, "user@example.com"));
    assert.notEqual(rateLimitKey("signin", first, "a@example.com"), rateLimitKey("signin", first, "b@example.com"));
    assert.equal(rateLimitKey("register", first, "a@example.com"), rateLimitKey("register", first, "b@example.com"));
    assert.notEqual(rateLimitKey("register", first), rateLimitKey("forgot-password", first));
    process.env.AUTH_TRUSTED_IP_HEADER = "x-forwarded-for";
    assert.notEqual(rateLimitKey("signin", first), rateLimitKey("signin", second));
    const malformed = new Request("https://example.com", { headers: { "x-forwarded-for": "192.0.2.1, 192.0.2.2" } });
    assert.equal(rateLimitKey("signin", malformed), rateLimitKey("signin", new Request("https://example.com")));
    assert.match(rateLimitKey("signin", first, "user@example.com")!, /^[a-f0-9]{64}$/);
  } finally {
    if (previous === undefined) delete process.env.AUTH_TRUSTED_IP_HEADER;
    else process.env.AUTH_TRUSTED_IP_HEADER = previous;
  }
});

test("missing, malformed, and untrusted IP headers skip Redis for every operation", async () => {
  const previous = process.env.AUTH_TRUSTED_IP_HEADER;
  let calls = 0;
  const client = { async limit() { calls++; return { success: false, remaining: 0, reset: Date.now() + 60000 }; } };
  async function assertSkipped(request: Request) {
    for (const operation of Object.keys(AUTH_LIMITS) as (keyof typeof AUTH_LIMITS)[]) {
      assert.equal(rateLimitKey(operation, request), undefined);
      const result = await checkRateLimit(operation, request, "user@example.com", client);
      assert.equal(result.success, true);
      assert.equal(result.remaining, AUTH_LIMITS[operation].attempts);
    }
  }
  try {
    delete process.env.AUTH_TRUSTED_IP_HEADER;
    await assertSkipped(new Request("https://example.com", { headers: { "x-forwarded-for": "192.0.2.1" } }));
    process.env.AUTH_TRUSTED_IP_HEADER = "x-trusted-ip";
    for (const value of [undefined, "", "invalid", "192.0.2.1, 192.0.2.2"]) {
      await assertSkipped(new Request("https://example.com", {
        headers: { "x-forwarded-for": "192.0.2.1", ...(value === undefined ? {} : { "x-trusted-ip": value }) },
      }));
    }
    assert.equal(calls, 0);
  } finally {
    if (previous === undefined) delete process.env.AUTH_TRUSTED_IP_HEADER;
    else process.env.AUTH_TRUSTED_IP_HEADER = previous;
  }
});

test("rate-limit results retain denial and reset metadata, while outages fail open", async (t) => {
  const previous = process.env.AUTH_TRUSTED_IP_HEADER;
  process.env.AUTH_TRUSTED_IP_HEADER = "x-trusted-ip";
  t.after(() => {
    if (previous === undefined) delete process.env.AUTH_TRUSTED_IP_HEADER;
    else process.env.AUTH_TRUSTED_IP_HEADER = previous;
  });
  const request = new Request("https://example.com", { headers: { "x-trusted-ip": "192.0.2.1" } });
  const denied = { success: false, remaining: 0, reset: Date.now() + 900000 };
  const result = await checkRateLimit("signin", request, "user@example.com", {
    async limit(key) { assert.match(key, /^[a-f0-9]{64}$/); return denied; },
  });
  assert.deepEqual(result, denied);
  const failed = await checkRateLimit("signin", request, "", { async limit() { throw new Error("offline"); } });
  assert.equal(failed.success, true);
  const response = rateLimitResponse(new AuthRateLimitError(61));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "61");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await response.json()).error, "Too many attempts. Please try again in 2 minutes.");
});

test("endpoint policies match the specification", () => {
  assert.deepEqual(Object.values(AUTH_LIMITS).map(({ attempts, window, identifier }) => [attempts, window, identifier]), [
    [5, "15 m", true], [3, "1 h", false], [3, "1 h", false], [5, "15 m", false], [3, "15 m", true],
  ]);
});

test("credentials callback returns 429 while preserving the Auth.js client error URL and cookies", async () => {
  const request = new Request("http://localhost:3000/api/auth/callback/credentials", { method: "POST" });
  const url = "http://localhost:3000/sign-in?error=CredentialsSignin&code=rate_limited_90";
  let response = Response.json({ url }, { headers: { "Set-Cookie": "auth-test=value; HttpOnly" } });
  const limited = await authRateLimitResponse(response, request);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "90");
  assert.equal(limited.headers.get("Set-Cookie"), "auth-test=value; HttpOnly");
  assert.deepEqual(await limited.json(), { url, error: "Too many attempts. Please try again in 2 minutes." });
  response = Response.redirect(url);
  assert.equal((await authRateLimitResponse(response, request)).status, 429);
  response = Response.json({ url: "http://localhost:3000/dashboard" });
  assert.equal(await authRateLimitResponse(response, request), response);
  response = Response.json({ url });
  assert.equal(await authRateLimitResponse(response, new Request("http://localhost:3000/api/auth/signin/github", { method: "POST" })), response);
});
