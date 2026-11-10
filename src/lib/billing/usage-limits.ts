import "server-only";

import type { Prisma, Plan } from "@/generated/prisma/client";

export const FREE_ITEM_LIMIT = 50;
export const FREE_COLLECTION_LIMIT = 3;

export type EntitlementErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "ITEM_LIMIT_REACHED"
  | "COLLECTION_LIMIT_REACHED"
  | "PRO_REQUIRED";

const messages: Record<EntitlementErrorCode, string> = {
  ACCOUNT_NOT_FOUND: "Account not found.",
  ITEM_LIMIT_REACHED: `Free accounts can store up to ${FREE_ITEM_LIMIT} items. Delete an item to free a slot or upgrade to Pro.`,
  COLLECTION_LIMIT_REACHED: `Free accounts can create up to ${FREE_COLLECTION_LIMIT} collections. Delete a collection to free a slot or upgrade to Pro.`,
  PRO_REQUIRED: "This operation requires DevStash Pro. Upgrade to continue.",
};

export class EntitlementError extends Error {
  constructor(readonly code: EntitlementErrorCode) {
    super(messages[code]);
    this.name = "EntitlementError";
  }
}

/** Use this row lock in billing reconciliation and hold it through the write.
 * Capacity checks rely on PostgreSQL's READ COMMITTED isolation for a fresh count after locking.
 */
export async function lockBillingOwner(tx: Prisma.TransactionClient, userId: string) {
  const [owner] = await tx.$queryRaw<{ plan: Plan; billingRevision: number }[]>`
    SELECT "plan", "billingRevision" FROM "User" WHERE "id" = ${userId} FOR UPDATE
  `;
  if (!owner) {
    throw new EntitlementError("ACCOUNT_NOT_FOUND");
  }
  return owner;
}

export async function assertItemCreationCapacity(tx: Prisma.TransactionClient, userId: string) {
  const { plan } = await lockBillingOwner(tx, userId);
  if (plan === "FREE" && await tx.item.count({ where: { userId } }) >= FREE_ITEM_LIMIT) {
    throw new EntitlementError("ITEM_LIMIT_REACHED");
  }
  return plan;
}

export async function assertCollectionCreationCapacity(tx: Prisma.TransactionClient, userId: string) {
  const { plan } = await lockBillingOwner(tx, userId);
  if (plan === "FREE" && await tx.collection.count({ where: { userId } }) >= FREE_COLLECTION_LIMIT) {
    throw new EntitlementError("COLLECTION_LIMIT_REACHED");
  }
}

export async function assertProAccess(tx: Prisma.TransactionClient, userId: string) {
  const { plan } = await lockBillingOwner(tx, userId);
  if (plan !== "PRO") {
    throw new EntitlementError("PRO_REQUIRED");
  }
}

export async function assertItemEditingAllowed(tx: Prisma.TransactionClient, userId: string) {
  const { plan } = await lockBillingOwner(tx, userId);
  if (plan === "FREE" && await tx.item.count({ where: { userId } }) > FREE_ITEM_LIMIT) {
    throw new EntitlementError("ITEM_LIMIT_REACHED");
  }
  return plan;
}

export async function assertCollectionEditingAllowed(tx: Prisma.TransactionClient, userId: string) {
  const { plan } = await lockBillingOwner(tx, userId);
  if (plan === "FREE" && await tx.collection.count({ where: { userId } }) > FREE_COLLECTION_LIMIT) {
    throw new EntitlementError("COLLECTION_LIMIT_REACHED");
  }
}
