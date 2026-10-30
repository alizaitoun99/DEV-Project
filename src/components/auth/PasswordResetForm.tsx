"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/auth-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PasswordResetFormProps { reset?: boolean; }
interface ResetResponse { success?: boolean; message?: string; error?: string; }

export function PasswordResetForm({ reset = false }: PasswordResetFormProps) {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const invalidLink = reset && !/^[a-f0-9]{64}$/.test(token);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = reset ? resetPasswordSchema.safeParse({ ...values, token }) : forgotPasswordSchema.safeParse(values);
    if (!parsed.success) { setError(parsed.error.issues[0].message); toast.error(parsed.error.issues[0].message); return; }
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(reset ? "/api/auth/reset-password" : "/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
      });
      const result: ResetResponse = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error ?? "Unable to process your request.");
      const feedback = reset ? "Your password has been reset. Sign in with your new password." : result.message ?? "Check your inbox for a reset link.";
      setMessage(feedback);
      toast.success(feedback);
      if (reset) window.history.replaceState(null, "", "/reset-password");
    } catch (cause) {
      const feedback = cause instanceof Error ? cause.message : "Unable to process your request. Please try again.";
      setError(feedback);
      toast.error(feedback);
    } finally { setPending(false); }
  }
  return (
    <div className="space-y-5">
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {invalidLink && !message && <p role="alert" className="text-sm text-destructive">Invalid reset link. Request a new one.</p>}
      {!message && !invalidLink && <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={pending} className="space-y-4">
          {reset ? <>
            <div className="space-y-2"><label htmlFor="password" className="text-sm font-medium">New password</label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required className="h-11" /><p className="text-xs text-muted-foreground">Use at least 8 characters, up to 72 bytes.</p></div>
            <div className="space-y-2"><label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</label><Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" maxLength={72} required className="h-11" /></div>
          </> : <div className="space-y-2"><label htmlFor="email" className="text-sm font-medium">Email</label><Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com" className="h-11" /></div>}
          <Button type="submit" className="h-11 w-full">{pending ? "Please wait…" : reset ? "Reset password" : "Send reset link"}</Button>
        </fieldset>
      </form>}
      {reset && <p className="text-center text-sm"><Link href="/forgot-password" className="text-primary underline underline-offset-4">Request a new reset link</Link></p>}
      <p className="text-center text-sm"><Link href="/sign-in" className="text-primary underline underline-offset-4">Back to sign in</Link></p>
    </div>
  );
}
