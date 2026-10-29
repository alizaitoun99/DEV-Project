"use server";

import { auth } from "@/auth";
import { changePasswordForUser, deleteAccountForUser } from "@/lib/profile-account";

export async function changePassword(input: unknown) {
  const session = await auth();
  if (!session?.user.id) return { success: false, error: "Please sign in again." };
  return changePasswordForUser(session.user.id, input);
}

export async function deleteAccount(input: unknown) {
  const session = await auth();
  if (!session?.user.id) return { success: false, error: "Please sign in again." };
  return deleteAccountForUser(session.user.id, input);
}
