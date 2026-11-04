"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ kind: z.enum(["item", "collection"]), id: z.string().trim().min(1).max(200), isFavorite: z.boolean() });
type Result = { success: true } | { success: false; error: string };

export async function setFavorite(input: unknown): Promise<Result> {
  try {
    const session = await auth();
    if (!session?.user.id) return { success: false, error: "Please sign in again." };
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid favorite request." };
    const { kind, id, isFavorite } = parsed.data;
    const args = { where: { id, userId: session.user.id }, data: { isFavorite } };
    const result = kind === "item" ? await prisma.item.updateMany(args) : await prisma.collection.updateMany(args);
    if (!result.count) return { success: false, error: "Item or collection not found." };
    revalidatePath("/", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Unable to update favorite. Please try again." };
  }
}
