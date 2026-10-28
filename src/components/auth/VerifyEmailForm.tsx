"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface VerificationResponse {
  success: boolean;
  error?: string;
}

export function VerifyEmailForm() {
  const token = useSearchParams().get("token");
  const router = useRouter();
  const [error, setError] = useState("");
  const request = useRef<{ token: string; result: Promise<VerificationResponse> } | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    // Reuse the request when React replays effects so a single-use token is sent once.
    if (request.current?.token !== token) {
      request.current = {
        token,
        result: fetch("/api/auth/verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }).then(async (response): Promise<VerificationResponse> => {
          const result: VerificationResponse = await response.json();
          return { success: response.ok && result.success, error: result.error };
        }),
      };
    }
    void request.current.result.then((result) => {
      if (!active) return;
      if (!result.success) {
        setError(result.error ?? "Unable to verify your email. Please request a new link from your dashboard.");
        return;
      }
      toast.dismiss("email-verification-reminder");
      toast.success("Your email address is verified!");
      router.replace("/dashboard");
      router.refresh();
    }).catch(() => {
      if (active) setError("Unable to verify your email. Check your connection and reopen the link to try again.");
    });
    return () => { active = false; };
  }, [token, router]);

  const message = !token ? "No verification token was provided. Sign in and request a new email from your dashboard." : error;
  return message ? <div className="space-y-4">
    <p role="alert" className="text-sm text-destructive">{message}</p>
    <Link href="/dashboard" className="block text-sm text-primary underline underline-offset-4">Continue to dashboard</Link>
  </div> : <p role="status" className="text-sm text-muted-foreground">Verifying your email and taking you to your dashboard…</p>;
}
