import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { GuestOnly } from "@/components/auth/GuestOnly";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata = { title: "Sign in | DevStash" };

export default function SignInPage() {
  return <AuthCard title="Welcome back" description="Sign in to your developer knowledge hub."><Suspense fallback={<p role="status">Loading sign-in…</p>}><GuestOnly><SignInForm /></GuestOnly></Suspense></AuthCard>;
}
