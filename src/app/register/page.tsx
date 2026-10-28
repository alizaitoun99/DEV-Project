import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = { title: "Create account | DevStash" };

export default function RegisterPage() {
  return <AuthCard title="Create your account" description="Keep your developer knowledge in one place."><RegisterForm /></AuthCard>;
}
