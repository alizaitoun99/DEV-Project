import { redirect } from "next/navigation";
import { findCurrentUser } from "@/lib/current-user";

export async function GuestOnly({ children }: { children: React.ReactNode }) {
  if (await findCurrentUser()) redirect("/dashboard");
  return children;
}
