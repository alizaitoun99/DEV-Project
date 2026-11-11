"use server";

import { z } from "zod";
import { resourceIdSchema } from "@/lib/resource-id";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { updateItemFlags } from "@/lib/db/items";
import { EntitlementError, type EntitlementErrorCode } from "@/lib/billing/usage-limits";

const schema = z.object({ id: resourceIdSchema, isPinned: z.boolean() });
type Result = { success: true } | { success: false; error: string; code?: EntitlementErrorCode };

export async function toggleItemPin(input: unknown): Promise<Result> {
  try {
    const session = await auth();
    if (!session?.user.id) return { success: false, error: "Please sign in again." };
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid pin request." };
    const { id, isPinned } = parsed.data;
    const result = await updateItemFlags(session.user.id, id, { isPinned });
    if (!result.count) return { success: false, error: "Item not found." };
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    if (error instanceof EntitlementError) return { success: false, error: error.message, code: error.code };
    return { success: false, error: "Unable to update pin. Please try again." };
  }
}
