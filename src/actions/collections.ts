"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { collectionCreateSchema } from "@/lib/collection-validation";
import { updateCollection as persist, deleteCollection as remove } from "@/lib/db/collections";

type Result = { success: true } | { success: false; error: string };
const idSchema = z.string().trim().min(1).max(200);

export async function updateCollection(collectionId: unknown, input: unknown): Promise<Result> {
  try {
    const session = await auth();
    if (!session?.user.id) return { success: false, error: "Please sign in again." };
    const id = idSchema.safeParse(collectionId);
    if (!id.success) return { success: false, error: "Invalid collection ID." };
    const fields = collectionCreateSchema.safeParse(input);
    if (!fields.success) return { success: false, error: fields.error.issues.map((issue) => issue.message).join("\n") };
    if (!await persist(session.user.id, id.data, fields.data)) return { success: false, error: "Collection not found." };
    revalidatePath("/", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Unable to save collection. Please try again." };
  }
}

export async function deleteCollection(collectionId: unknown): Promise<Result> {
  try {
    const session = await auth();
    if (!session?.user.id) return { success: false, error: "Please sign in again." };
    const id = idSchema.safeParse(collectionId);
    if (!id.success) return { success: false, error: "Invalid collection ID." };
    if (!await remove(session.user.id, id.data)) return { success: false, error: "Collection not found." };
    revalidatePath("/", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Unable to delete collection. Please try again." };
  }
}
