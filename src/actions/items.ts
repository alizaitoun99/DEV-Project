"use server";

import { auth } from "@/auth";
import { removeItemFromCollection as unlinkItem, updateItem as persistItem, type ItemDetail } from "@/lib/db/items";
import { itemUpdateSchema } from "@/lib/item-validation";
import { z } from "zod";
import { resourceIdSchema } from "@/lib/resource-id";
import { deleteItem as removeItem } from "@/lib/db/items";
import { createItem as insertItem } from "@/lib/db/items";
import { itemCreateSchema } from "@/lib/item-validation";
import { EntitlementError, type EntitlementErrorCode } from "@/lib/billing/usage-limits";

function formatItemIssues(issues: z.ZodError["issues"]) {
  return issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
}

type CreateResult = { success: true; data: { id: string } } | { success: false; error: string; code?: EntitlementErrorCode };

export async function createItem(input: unknown): Promise<CreateResult> {
  try {
    const session = await auth();
    if (!session?.user.id) return { success: false, error: "Please sign in again." };
    const parsed = itemCreateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: formatItemIssues(parsed.error.issues) };
    const item = await insertItem(session.user.id, parsed.data);
    return item ? { success: true, data: item } : { success: false, error: "This item type is unavailable." };
  } catch (error) {
    if (error instanceof EntitlementError) return { success: false, error: error.message, code: error.code };
    if (error instanceof z.ZodError) return { success: false, error: error.issues.map((issue) => issue.message).join(" ") };
    return { success: false, error: "Unable to create item. Please try again." };
  }
}

type DeleteResult = { success: true } | { success: false; error: string };

export async function deleteItem(itemId: unknown): Promise<DeleteResult> {
  try {
    const session = await auth();
    if (!session?.user.id) return { success: false, error: "Please sign in again." };
    const id = resourceIdSchema.safeParse(itemId);
    if (!id.success) return { success: false, error: "Invalid item ID." };
    const result = await removeItem(session.user.id, id.data);
    if (result === "stored-file") return { success: false, error: "This item has no file cleanup record. Contact the administrator before deleting it." };
    if (result === "deleted") {
      try {
        const { cleanupDeletedItem } = await import("@/lib/storage-uploads");
        await cleanupDeletedItem(session.user.id, id.data);
      } catch { console.error("Item storage cleanup deferred; durable record retained."); }
    }
    return result === "deleted" ? { success: true } : { success: false, error: "Item not found." };
  } catch {
    return { success: false, error: "Unable to delete item. Please try again." };
  }
}

type UpdateResult = { success: true; data: ItemDetail } | { success: false; error: string; code?: EntitlementErrorCode };

export async function updateItem(itemId: string, input: unknown): Promise<UpdateResult> {
  try {
    const session = await auth();
    if (!session?.user.id) return { success: false, error: "Please sign in again." };
    const id = resourceIdSchema.safeParse(itemId);
    const parsed = itemUpdateSchema.safeParse(input);
    if (!id.success) return { success: false, error: "Invalid item ID." };
    if (!parsed.success) return { success: false, error: formatItemIssues(parsed.error.issues) };
    const item = await persistItem(session.user.id, id.data, parsed.data);
    return item ? { success: true, data: item } : { success: false, error: "Item not found." };
  } catch (error) {
    if (error instanceof EntitlementError) return { success: false, error: error.message, code: error.code };
    if (error instanceof z.ZodError) return { success: false, error: formatItemIssues(error.issues) };
    return { success: false, error: "Unable to save item. Please try again." };
  }
}

export async function removeItemFromCollection(itemId: unknown, collectionId: unknown): Promise<DeleteResult> {
  try {
    const session = await auth();
    if (!session?.user.id) return { success: false, error: "Please sign in again." };
    const ids = z.tuple([z.string().min(1).max(200), z.string().min(1).max(200)]).safeParse([itemId, collectionId]);
    if (!ids.success) return { success: false, error: "Invalid item or collection." };
    await unlinkItem(session.user.id, ...ids.data);
    return { success: true };
  } catch {
    return { success: false, error: "Unable to remove the item from this collection." };
  }
}
