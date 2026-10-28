import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";

export const metadata = { title: "Verify email | DevStash", referrer: "no-referrer", robots: { index: false, follow: false } };

export default function VerifyEmailPage() {
  return <AuthCard title="Email verification" description="We’re checking your verification link."><Suspense fallback={<p role="status">Loading verification…</p>}><VerifyEmailForm /></Suspense></AuthCard>;
}
