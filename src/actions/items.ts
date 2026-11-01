"use server";

import { auth } from "@/auth";
import { updateItem as persistItem, type ItemDetail } from "@/lib/db/items";
import { itemUpdateSchema } from "@/lib/item-validation";
import { z } from "zod";
import { deleteItem as removeItem } from "@/lib/db/items";

type DeleteResult = { success: true } | { success: false; error: string };

export async function deleteItem(itemId: unknown): Promise<DeleteResult> {
  try {
    const session = await auth();
    if (!session?.user.id) return { success: false, error: "Please sign in again." };
    const id = z.string().trim().min(1).max(200).safeParse(itemId);
    if (!id.success) return { success: false, error: "Invalid item ID." };
    const result = await removeItem(session.user.id, id.data);
    if (result === "stored-file") return { success: false, error: "Items with uploaded files cannot be deleted until file cleanup is available." };
    return result === "deleted" ? { success: true } : { success: false, error: "Item not found." };
  } catch {
    return { success: false, error: "Unable to delete item. Please try again." };
  }
}

type UpdateResult = { success: true; data: ItemDetail } | { success: false; error: string };

export async function updateItem(itemId: string, input: unknown): Promise<UpdateResult> {
  try {
    const session = await auth();
    if (!session?.user.id) return { success: false, error: "Please sign in again." };
    const id = z.string().trim().min(1).max(200).safeParse(itemId);
    const parsed = itemUpdateSchema.safeParse(input);
    if (!id.success) return { success: false, error: "Invalid item ID." };
    if (!parsed.success) return { success: false, error: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n") };
    const item = await persistItem(session.user.id, id.data, parsed.data);
    return item ? { success: true, data: item } : { success: false, error: "Item not found." };
  } catch {
    return { success: false, error: "Unable to save item. Please try again." };
  }
}
