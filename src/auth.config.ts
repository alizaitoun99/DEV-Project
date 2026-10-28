import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";

export default {
  pages: { signIn: "/sign-in" },
  providers: [GitHub, Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize: () => null,
  })],
} satisfies NextAuthConfig;
