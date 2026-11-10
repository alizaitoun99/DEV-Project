import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { GuestOnly } from "@/components/auth/GuestOnly";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = { title: "Create account | DevStash" };

export default function RegisterPage() {
  return <AuthCard title="Create your account" description="Keep your developer knowledge in one place."><Suspense fallback={<p role="status">Loading registration…</p>}><GuestOnly><RegisterForm /></GuestOnly></Suspense></AuthCard>;
}
