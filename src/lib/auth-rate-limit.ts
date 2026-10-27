import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/email";

type AuthOperation = "signin" | "register";

interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

interface RateLimitStore {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

export class AuthRateLimitError extends Error {
  constructor(public readonly retryAfter: number) {
    super("Too many attempts. Please try again later.");
  }
}

/** Atomic fixed windows, shared by all instances. Storage failures deny the request. */
export async function consumeAuthLimit(
  key: string,
  limit: number,
  seconds: number,
  store: RateLimitStore = prisma,
): Promise<void> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for authentication throttling.");
  const digest = createHmac("sha256", secret).update(key).digest("hex");
  const [result] = await store.$queryRaw<RateLimitResult[]>`
    WITH cleanup AS (
      DELETE FROM "AuthRateLimit" WHERE "key" IN (
        SELECT "key" FROM "AuthRateLimit"
        WHERE "expiresAt" < CURRENT_TIMESTAMP - INTERVAL '1 day' AND "key" <> ${digest}
        ORDER BY "expiresAt" LIMIT 100
        FOR UPDATE SKIP LOCKED
      )
    )
    INSERT INTO "AuthRateLimit" ("key", "attempts", "expiresAt")
    VALUES (${digest}, 1, CURRENT_TIMESTAMP + ${seconds} * INTERVAL '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "AuthRateLimit"."expiresAt" <= CURRENT_TIMESTAMP
        THEN 1 ELSE LEAST("AuthRateLimit"."attempts" + 1, ${limit + 1}) END,
      "expiresAt" = CASE WHEN "AuthRateLimit"."expiresAt" <= CURRENT_TIMESTAMP
        THEN EXCLUDED."expiresAt" ELSE "AuthRateLimit"."expiresAt" END
    RETURNING "attempts" <= ${limit} AS "allowed",
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("expiresAt" - CURRENT_TIMESTAMP))))::int AS "retryAfter"
  `;
  if (!result) throw new Error("Authentication rate-limit storage returned no result.");
  if (!result.allowed) throw new AuthRateLimitError(result.retryAfter);
}

export async function limitAuthRequest(operation: AuthOperation, request: Request): Promise<void> {
  // Trust a header only when the deployment proxy overwrites it and direct access is blocked.
  const header = process.env.AUTH_TRUSTED_IP_HEADER;
  const candidate = header ? request.headers.get(header)?.trim() : undefined;
  const ip = candidate && isIP(candidate) ? candidate : undefined;
  const seconds = operation === "signin" ? 15 * 60 : 60 * 60;
  const limit = operation === "signin" ? (ip ? 30 : 300) : (ip ? 10 : 50);
  await consumeAuthLimit(`${operation}:network:${ip ?? "shared"}`, limit, seconds);
}

export async function limitAuthAccount(operation: AuthOperation, email: string): Promise<void> {
  await consumeAuthLimit(
    `${operation}:account:${normalizeEmail(email)}`,
    operation === "signin" ? 5 : 3,
    operation === "signin" ? 15 * 60 : 60 * 60,
  );
}
