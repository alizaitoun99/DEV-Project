import { after } from "next/server";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/auth-validation";
import { AuthRateLimitError, limitAuthAccount, limitAuthRequest } from "@/lib/auth-rate-limit";
import { prisma } from "@/lib/prisma";
import { resetPassword, sendPasswordResetEmail } from "@/lib/password-reset";

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return Response.json({ error: "Invalid request origin." }, { status: 403 });
    }
    await limitAuthRequest("password-reset", request);
    let body: unknown;
    try { body = await request.json(); }
    catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
    if (typeof body === "object" && body !== null && "token" in body) {
      const parsed = resetPasswordSchema.safeParse(body);
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
      const success = await resetPassword(parsed.data.token, parsed.data.password);
      return Response.json({ success, error: success ? undefined : "This reset link is invalid, expired, or already used. Request a new link." }, { status: success ? 200 : 400 });
    }
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    await limitAuthAccount("password-reset", parsed.data.email);
    // Keep account lookup and provider latency out of the public response timing.
    after(async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email }, select: { id: true, email: true, passwordHash: true },
        });
        if (user?.passwordHash && user.email) {
          await sendPasswordResetEmail({ id: user.id, email: user.email });
        }
      } catch { console.error("Password reset email delivery failed."); }
    });
    return Response.json({ success: true, message: "If this email has a password account, a reset link will be sent. Check your inbox and spam folder." });
  } catch (error) {
    if (error instanceof AuthRateLimitError) {
      return Response.json({ error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfter) } });
    }
    return Response.json({ error: "Unable to process your request. Please try again later." }, { status: 503 });
  }
}
