"use server";

import { z } from "zod";
import { resourceIdSchema } from "@/lib/resource-id";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { updateItemFlags } from "@/lib/db/items";
import { prisma } from "@/lib/prisma";
import { assertCollectionEditingAllowed, EntitlementError, type EntitlementErrorCode } from "@/lib/billing/usage-limits";

const schema = z.object({ kind: z.enum(["item", "collection"]), id: resourceIdSchema, isFavorite: z.boolean() });
type Result = { success: true } | { success: false; error: string; code?: EntitlementErrorCode };

export async function setFavorite(input: unknown): Promise<Result> {
  try {
    const session = await auth();
    if (!session?.user.id) return { success: false, error: "Please sign in again." };
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid favorite request." };
    const { kind, id, isFavorite } = parsed.data;
    const userId = session.user.id;
    const result = kind === "item"
      ? await updateItemFlags(userId, id, { isFavorite })
      : await prisma.$transaction(async (tx) => {
        await assertCollectionEditingAllowed(tx, userId);
        return tx.collection.updateMany({ where: { id, userId }, data: { isFavorite } });
      });
    if (!result.count) return { success: false, error: "Item or collection not found." };
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    if (error instanceof EntitlementError) return { success: false, error: error.message, code: error.code };
    return { success: false, error: "Unable to update favorite. Please try again." };
  }
}
