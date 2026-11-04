"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { editorPreferencesSchema } from "@/lib/editor-preferences";

export async function updateEditorPreferences(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user.id) return { success: false, error: "Please sign in again." };
    const parsed = editorPreferencesSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid editor preferences." };
    const result = await prisma.user.updateMany({
      where: { id: session.user.id }, data: { editorPreferences: parsed.data },
    });
    if (!result.count) return { success: false, error: "Account not found." };
    return { success: true, data: parsed.data };
  } catch {
    return { success: false, error: "Unable to save editor preferences. Please try again." };
  }
}
