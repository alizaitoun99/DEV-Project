"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { GitBranch } from "lucide-react";
import { credentialsSchema } from "@/lib/auth-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function authError(error: string | null, code?: string | null) {
  if (!error) return "";
  if (code?.startsWith("rate_limited")) {
    const seconds = Number(code.replace("rate_limited_", ""));
    return Number.isFinite(seconds) && seconds > 0
      ? `Too many attempts. Please try again in ${Math.max(1, Math.ceil(seconds / 60))} minutes.`
      : "Too many sign-in attempts. Please try again later.";
  }
  if (error === "CredentialsSignin") return "Email or password is incorrect.";
  if (error === "OAuthAccountNotLinked")
    return "Sign in using the method originally used for this email address.";
  return "Unable to sign in. Please try again.";
}

export function SignInForm() {
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get("callbackUrl");
  const callbackUrl =
    requested?.startsWith("/") &&
    !requested.startsWith("//") &&
    !/[\\\s]/.test(requested)
      ? requested
      : "/dashboard";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const callbackError = authError(params.get("error"), params.get("code"));
  const displayedError = error || callbackError;
  useEffect(() => {
    if (callbackError)
      toast.error(callbackError, { id: "auth-callback-error" });
  }, [callbackError]);
  function showError(message: string) {
    setError(message);
    toast.error(message);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = credentialsSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    if (!parsed.success) {
      showError(parsed.error.issues[0].message);
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        ...parsed.data,
        redirect: false,
        redirectTo: callbackUrl,
      });
      if (result.error) showError(authError(result.error, result.code));
      else {
        router.replace(callbackUrl);
        router.refresh();
        toast.success("You’re now signed in!");
        return;
      }
    } catch {
      showError("Unable to sign in. Please try again.");
    } finally {
      setPending(false);
    }
  }
  async function github() {
    setPending(true);
    setError("");
    try {
      await signIn("github", { redirectTo: callbackUrl });
    } catch {
      showError("Unable to connect to GitHub. Please try again.");
      setPending(false);
    }
  }
  return (
    <div className="space-y-5">
      {displayedError && (
        <p id="signin-error" role="alert" className="text-sm text-destructive">
          {displayedError}
        </p>
      )}
      <form
        onSubmit={submit}
        aria-describedby={displayedError ? "signin-error" : undefined}
        className="space-y-4"
      >
        <fieldset disabled={pending} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              maxLength={254}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11"
            />
          </div>

          <Button type="submit" className="h-11 w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm text-primary underline underline-offset-4"
            >
              Forgot password?
            </Link>
          </div>
        </fieldset>
      </form>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or continue with
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => void github()}
        className="h-11 w-full"
      >
        <GitBranch aria-hidden="true" />
        Sign in with GitHub
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New to DevStash?{" "}
        <Link
          href="/register"
          className="text-primary underline underline-offset-4"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
