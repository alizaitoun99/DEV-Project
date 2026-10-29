import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

export const metadata = { title: "Reset password | DevStash", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default function ResetPasswordPage() {
  return <AuthCard title="Reset your password" description="Choose a new password for your DevStash account."><Suspense fallback={<p role="status">Loading…</p>}><PasswordResetForm reset /></Suspense></AuthCard>;
}
