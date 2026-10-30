import NextAuth, { CredentialsSignin } from "next-auth";
import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { compare } from "bcryptjs";
import { credentialsSchema } from "@/lib/auth-validation";
import { authAdapter } from "@/lib/auth-adapter";
import { AuthRateLimitError, limitAuthAccount, limitAuthRequest } from "@/lib/auth-rate-limit";
import { enforceRateLimit } from "@/lib/rate-limit";

class RateLimitedCredentials extends CredentialsSignin {
  code = "rate_limited";

  constructor(retryAfter: number) {
    super();
    this.code = `rate_limited_${retryAfter}`;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [GitHub, Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials, request) {
      try {
        await limitAuthRequest("signin", request);
      } catch (error) {
        if (error instanceof AuthRateLimitError) throw new RateLimitedCredentials(error.retryAfter);
        throw error;
      }
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) return null;

      try {
        await enforceRateLimit("signin", request, parsed.data.email);
        await limitAuthAccount("signin", parsed.data.email);
      } catch (error) {
        if (error instanceof AuthRateLimitError) throw new RateLimitedCredentials(error.retryAfter);
        throw error;
      }

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email },
        select: { id: true, name: true, email: true, image: true, passwordHash: true },
      });
      if (!user?.passwordHash || !(await compare(parsed.data.password, user.passwordHash))) {
        return null;
      }
      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  })],
  adapter: authAdapter,
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
