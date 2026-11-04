import { z } from "zod";

export const collectionCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(500, "Name must be 500 characters or fewer."),
  description: z.string().trim().max(10000, "Description must be 10,000 characters or fewer.").nullable().optional(),
});

export type CollectionCreateInput = z.infer<typeof collectionCreateSchema>;

export interface CollectionCreateResponse {
  success: boolean;
  data?: { id: string; name: string; description: string | null };
  error?: string;
}
