"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface VerificationReminderProps { verified: boolean; }

export function VerificationReminder({ verified }: VerificationReminderProps) {
  const router = useRouter();
  useEffect(() => {
    const id = "email-verification-reminder";
    if (verified) { toast.dismiss(id); return; }
    async function resend() {
      try {
        const response = await fetch("/api/auth/verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const result = await response.json();
        if (!response.ok) { toast.error(result.error); return; }
        if (result.verified) router.refresh();
        else toast.success("Verification email sent. Please check your inbox.");
      } catch { toast.error("Unable to send email. Please try again later."); }
    }
    toast.warning("Please check your email and click the verification link to verify your email address.", {
      id, duration: Infinity, dismissible: false, closeButton: false,
      className: "verification-reminder",
      action: { label: "Resend email", onClick: (event) => { event.preventDefault(); void resend(); } },
    });
    const refresh = () => router.refresh();
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { toast.dismiss(id); window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [verified, router]);
  return null;
}
