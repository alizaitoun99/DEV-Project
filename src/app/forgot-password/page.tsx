import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

export const metadata = { title: "Forgot password | DevStash", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <AuthCard title="Forgot your password?" description="Enter your email to request a password reset link."><Suspense fallback={<p role="status">Loading…</p>}><PasswordResetForm /></Suspense></AuthCard>;
}
