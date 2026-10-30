import { hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { registrationSchema } from "@/lib/auth-validation";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email-verification";
import { isEmailVerificationEnabled } from "@/lib/email-verification-config";
import { AuthRateLimitError, limitAuthAccount, limitAuthRequest } from "@/lib/auth-rate-limit";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

function registrationError(error: unknown): Response {
  if (error instanceof AuthRateLimitError) {
    return rateLimitResponse(error);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return Response.json({ success: false, error: "An account with this email already exists." }, { status: 409 });
  }
  return Response.json({ success: false, error: "Unable to create account. Please try again." }, { status: 503 });
}

export async function POST(request: Request) {
  try {
    await enforceRateLimit("register", request);
    await limitAuthRequest("register", request);
  } catch (error) {
    return registrationError(error);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const { name, email, password } = parsed.data;
    await limitAuthAccount("register", email);
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return Response.json({ success: false, error: "An account with this email already exists." }, { status: 409 });
    }
    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, name: true, email: true },
    });
    let verificationEmailSent = false;
    const verificationEnabled = isEmailVerificationEnabled();
    try {
      verificationEmailSent = await sendVerificationEmail({ id: user.id, email });
    } catch {
      // Account creation succeeded; let the user sign in and retry delivery.
    }
    return Response.json({ success: true, data: user, verificationEnabled, verificationEmailSent }, { status: 201 });
  } catch (error) {
    return registrationError(error);
  }
}
