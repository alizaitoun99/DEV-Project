import { auth } from "@/auth";
import { consumeAuthLimit, AuthRateLimitError } from "@/lib/auth-rate-limit";
import {
  sendVerificationEmail,
  verifyEmailToken,
} from "@/lib/email-verification";
import { prisma } from "@/lib/prisma";
import { isEmailVerificationEnabled } from "@/lib/email-verification-config";

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return Response.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }
    if (typeof body !== "object" || body === null)
      return Response.json({ error: "Invalid request." }, { status: 400 });
    if ("token" in body) {
      if (typeof body.token !== "string")
        return Response.json(
          { error: "Invalid verification link." },
          { status: 400 },
        );
      const verified = await verifyEmailToken(body.token);
      return Response.json(
        {
          success: verified,
          error: verified
            ? undefined
            : "This verification link is invalid, expired, or already used. Sign in to request a new email.",
        },
        { status: verified ? 200 : 400 },
      );
    }
    const session = await auth();
    if (!session?.user.id)
      return Response.json({ error: "Please sign in." }, { status: 401 });
    if (!isEmailVerificationEnabled())
      return Response.json({ error: "Email verification is currently disabled." }, { status: 403 });
    await consumeAuthLimit(`verification:${session.user.id}`, 3, 3600);
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, emailVerified: true },
    });
    if (!user?.email)
      return Response.json(
        { error: "No email address is available." },
        { status: 400 },
      );
    if (!user.emailVerified)
      await sendVerificationEmail({ id: user.id, email: user.email });
    return Response.json({
      success: true,
      verified: Boolean(user.emailVerified),
    });
  } catch (error) {
    if (error instanceof AuthRateLimitError)
      return Response.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    return Response.json(
      { error: "Unable to send or verify your email. Please try again later." },
      { status: 503 },
    );
  }
}
