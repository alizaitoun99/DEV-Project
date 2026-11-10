"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertCollectionEditingAllowed, assertItemEditingAllowed, EntitlementError, type EntitlementErrorCode } from "@/lib/billing/usage-limits";

const schema = z.object({ kind: z.enum(["item", "collection"]), id: z.string().trim().min(1).max(200), isFavorite: z.boolean() });
type Result = { success: true } | { success: false; error: string; code?: EntitlementErrorCode };

export async function setFavorite(input: unknown): Promise<Result> {
  try {
    const session = await auth();
    if (!session?.user.id) return { success: false, error: "Please sign in again." };
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid favorite request." };
    const { kind, id, isFavorite } = parsed.data;
    const userId = session.user.id;
    const args = { where: { id, userId }, data: { isFavorite } };
    const result = await prisma.$transaction(async (tx) => {
      if (kind === "item") {
        await assertItemEditingAllowed(tx, userId);
        return tx.item.updateMany(args);
      }
      await assertCollectionEditingAllowed(tx, userId);
      return tx.collection.updateMany(args);
    });
    if (!result.count) return { success: false, error: "Item or collection not found." };
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    if (error instanceof EntitlementError) return { success: false, error: error.message, code: error.code };
    return { success: false, error: "Unable to update favorite. Please try again." };
  }
}
