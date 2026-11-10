"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { GitBranch } from "lucide-react";
import { toast } from "sonner";
import { registrationSchema } from "@/lib/auth-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RegistrationResponse {
  success?: boolean;
  error?: string;
  verificationEmailSent?: boolean;
  verificationEnabled?: boolean;
}

const fields = [
  { name: "name", label: "Name", type: "text", autoComplete: "name", maxLength: 100 },
  { name: "email", label: "Email", type: "email", autoComplete: "email", maxLength: 254 },
  { name: "password", label: "Password", type: "password", autoComplete: "new-password", maxLength: 72 },
  { name: "confirmPassword", label: "Confirm password", type: "password", autoComplete: "new-password", maxLength: 72 },
];

export function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  function showError(message: string) {
    setError(message);
    toast.error(message);
  }
  async function signInNewAccount(email: string, password: string) {
    try {
      const result = await signIn("credentials", { email, password, redirect: false, redirectTo: "/dashboard" });
      if (!result.error) {
        router.replace("/dashboard");
        router.refresh();
        toast.success("Account created. You’re now signed in!");
        return;
      }
    } catch {
      // The account exists even if the separate sign-in request fails.
    }
    toast.error("Account created, but automatic sign-in failed. Please sign in.");
    router.replace("/sign-in");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = registrationSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) { showError(parsed.error.issues[0].message); return; }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const result: RegistrationResponse = await response.json();
      if (response.ok && result.success) {
        if (result.verificationEnabled !== false && result.verificationEmailSent === false) toast.error("Account created, but the verification email could not be sent. Use Resend email on your dashboard to try again.", { duration: 10000 });
        await signInNewAccount(parsed.data.email, parsed.data.password);
        return;
      }
      showError(result.error ?? "Unable to create account. Please try again.");
    } catch { showError("Unable to create account. Check your connection and try again."); }
    finally { setPending(false); }
  }
  async function registerWithGitHub() {
    setPending(true);
    setError("");
    try {
      await signIn("github", { redirectTo: "/dashboard" });
    } catch {
      showError("Unable to connect to GitHub. Please try again.");
      setPending(false);
    }
  }
  return (
    <div className="space-y-5">
      {error && <p id="register-error" role="alert" className="text-sm text-destructive">{error}</p>}
      <form onSubmit={submit} aria-describedby={error ? "register-error" : undefined}>
        <fieldset disabled={pending} className="space-y-4">
          {fields.map((field) => <div key={field.name} className="space-y-2"><label htmlFor={field.name} className="text-sm font-medium">{field.label}</label><Input {...field} id={field.name} required minLength={field.type === "password" ? 8 : undefined} aria-describedby={field.name === "password" ? "password-help" : undefined} className="h-11" />{field.name === "password" && <p id="password-help" className="text-xs text-muted-foreground">At least 8 characters, up to 72 bytes.</p>}</div>)}
          <Button type="submit" className="h-11 w-full">{pending ? "Creating account…" : "Create account"}</Button>
        </fieldset>
      </form>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or continue with
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" disabled={pending} onClick={registerWithGitHub} className="h-11 w-full">
        <GitBranch aria-hidden="true" />
        Register with GitHub
      </Button>
      <p className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/sign-in" className="text-primary underline underline-offset-4">Sign in</Link></p>
    </div>
  );
}
