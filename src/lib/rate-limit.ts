import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { normalizeEmail } from "@/lib/email";
import { AuthRateLimitError, consumeAuthLimit } from "@/lib/auth-rate-limit";
import type { Prisma } from "@/generated/prisma/client";

const AI_LIMIT = { attempts: 20, seconds: 60 * 60 };

export function enforceAiRateLimit(userId: string, tx: Prisma.TransactionClient) {
  return consumeAuthLimit(`ai:user:${userId}`, AI_LIMIT.attempts, AI_LIMIT.seconds, tx);
}

export const AUTH_LIMITS = {
  signin: { attempts: 5, window: "15 m", identifier: true },
  register: { attempts: 3, window: "1 h", identifier: false },
  "forgot-password": { attempts: 3, window: "1 h", identifier: false },
  "reset-password": { attempts: 5, window: "15 m", identifier: false },
  "resend-verification": { attempts: 3, window: "15 m", identifier: true },
} as const;

export type RateLimitOperation = keyof typeof AUTH_LIMITS;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export interface RateLimitClient {
  limit(key: string): Promise<RateLimitResult>;
}

const limiters = new Map<RateLimitOperation, Ratelimit>();

export function rateLimitKey(operation: RateLimitOperation, request: Request, email = ""): string | undefined {
  // Only trust a proxy-overwritten header when direct origin access is blocked.
  const header = process.env.AUTH_TRUSTED_IP_HEADER;
  const candidate = header ? request.headers.get(header)?.trim() : undefined;
  if (!candidate || !isIP(candidate)) return undefined;
  const ip = candidate;
  const identifier = AUTH_LIMITS[operation].identifier ? normalizeEmail(email) : "";
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for authentication throttling.");
  return createHmac("sha256", secret).update(JSON.stringify([operation, ip, identifier])).digest("hex");
}

function getLimiter(operation: RateLimitOperation): RateLimitClient | undefined {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return undefined;
  let limiter = limiters.get(operation);
  if (!limiter) {
    const policy = AUTH_LIMITS[operation];
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(policy.attempts, policy.window),
      prefix: `devstash:auth:${operation}`,
      timeout: 1000,
      analytics: false,
      ephemeralCache: false,
    });
    limiters.set(operation, limiter);
  }
  return limiter;
}

/** Redis outages fail open; independent PostgreSQL safeguards remain active. */
export async function checkRateLimit(
  operation: RateLimitOperation,
  request: Request,
  email = "",
  client?: RateLimitClient,
): Promise<RateLimitResult> {
  const key = rateLimitKey(operation, request, email);
  // PostgreSQL already provides broader shared and account budgets without a trusted IP.
  if (!key) return { success: true, remaining: AUTH_LIMITS[operation].attempts, reset: Date.now() };
  try {
    const limiter = client ?? getLimiter(operation);
    if (limiter) {
      const { success, remaining, reset } = await limiter.limit(key);
      return { success, remaining, reset };
    }
  } catch {
    console.error("Upstash authentication rate limit unavailable; using existing safeguards.");
  }
  return { success: true, remaining: AUTH_LIMITS[operation].attempts, reset: Date.now() };
}

export async function enforceRateLimit(operation: RateLimitOperation, request: Request, email = "") {
  const result = await checkRateLimit(operation, request, email);
  if (!result.success) {
    throw new AuthRateLimitError(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)));
  }
}

export function rateLimitResponse(error: AuthRateLimitError): Response {
  return Response.json({ success: false, error: error.message }, {
    status: 429,
    headers: { "Retry-After": String(error.retryAfter), "Cache-Control": "no-store" },
  });
}

export async function authRateLimitResponse(response: Response, request: Request): Promise<Response> {
  if (new URL(request.url).pathname !== "/api/auth/callback/credentials") return response;
  // Auth.js encodes CredentialsSignin errors in its redirect URL, even for JSON clients.
  let url = response.headers.get("location");
  if (!url && response.headers.get("content-type")?.includes("application/json")) {
    const body: unknown = await response.clone().json();
    if (typeof body === "object" && body !== null && "url" in body && typeof body.url === "string") url = body.url;
  }
  const code = url ? new URL(url, request.url).searchParams.get("code") : null;
  const match = code?.match(/^rate_limited_(\d+)$/);
  if (!match) return response;
  const retryAfter = Math.max(1, Number(match[1]));
  const headers = new Headers(response.headers);
  headers.delete("location");
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  headers.set("Retry-After", String(retryAfter));
  return Response.json({ error: new AuthRateLimitError(retryAfter).message, url }, { status: 429, headers });
}
