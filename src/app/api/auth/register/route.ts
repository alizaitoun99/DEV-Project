import { hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { registrationSchema } from "@/lib/auth-validation";
import { prisma } from "@/lib/prisma";
import { AuthRateLimitError, limitAuthAccount, limitAuthRequest } from "@/lib/auth-rate-limit";

function registrationError(error: unknown): Response {
  if (error instanceof AuthRateLimitError) {
    return Response.json({ success: false, error: error.message }, {
      status: 429,
      headers: { "Retry-After": String(error.retryAfter), "Cache-Control": "no-store" },
    });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return Response.json({ success: false, error: "An account with this email already exists." }, { status: 409 });
  }
  return Response.json({ success: false, error: "Unable to create account. Please try again." }, { status: 503 });
}

export async function POST(request: Request) {
  try {
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
    return Response.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    return registrationError(error);
  }
}
