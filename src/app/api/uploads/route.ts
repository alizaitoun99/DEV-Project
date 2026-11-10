import { auth } from "@/auth";
import { beginUpload, finishUpload, UploadError } from "@/lib/storage-uploads";
import { abandonUploadRecord } from "@/lib/db/items";
import { z } from "zod";
import { AuthRateLimitError } from "@/lib/auth-rate-limit";
import { EntitlementError } from "@/lib/billing/usage-limits";

const headers = { "Cache-Control": "private, no-store" };
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("begin"), file: z.unknown() }),
  z.object({ action: z.literal("finish"), id: z.string().min(1).max(200), item: z.unknown() }),
  z.object({ action: z.literal("abandon"), id: z.string().min(1).max(200) }),
]);

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403, headers });
    const session = await auth();
    if (!session?.user.id) return Response.json({ error: "Please sign in again." }, { status: 401, headers });
    const text = await request.text();
    if (text.length > 20000) return Response.json({ error: "Request too large." }, { status: 413, headers });
    const input = requestSchema.parse(JSON.parse(text));
    const userId = session.user.id;
    const data = input.action === "begin" ? await beginUpload(userId, input.file) : input.action === "finish" ?
      await finishUpload(userId, input.id, input.item) : await abandonUploadRecord(userId, input.id);
    return Response.json({ data }, { headers });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return Response.json({ error: error.message, code: error.code }, { status: 403, headers });
    }
    const limited = error instanceof AuthRateLimitError;
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(" ") :
      error instanceof UploadError || limited ? error.message : "Unable to process upload. Please try again.";
    return Response.json({ error: message }, { status: limited ? 429 : 400, headers: { ...headers, ...(limited ? { "Retry-After": String(error.retryAfter) } : {}) } });
  }
}
