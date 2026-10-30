import { handlers } from "@/auth";
import type { NextRequest } from "next/server";
import { authRateLimitResponse } from "@/lib/rate-limit";

export const { GET } = handlers;

export async function POST(request: NextRequest) {
  return authRateLimitResponse(await handlers.POST(request), request);
}
