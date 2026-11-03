import { timingSafeEqual } from "node:crypto";
import { runStorageCleanup } from "@/lib/storage-uploads";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return new Response(null, { status: 401 });
  try {
    return Response.json(await runStorageCleanup(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Cleanup unavailable. Retry required." }, { status: 503 });
  }
}
