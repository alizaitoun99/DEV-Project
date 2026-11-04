import { z } from "zod";

const requiredUrlSchema = z.string({ error: "URL is required for links." }).trim().min(1, "URL is required for links.").url("Enter a valid URL.").refine((value) => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS URL.");

export const itemUpdateSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(500),
  description: z.string().max(10000).nullable().optional(),
  content: z.string().max(500000).nullable().optional(),
  language: z.string().trim().max(100).nullable().optional(),
  url: requiredUrlSchema.nullable().optional(),
  collectionIds: z.array(z.string().trim().min(1).max(200)).max(100).transform((ids) => [...new Set(ids)]).optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(50),
});

export type ItemUpdateInput = z.infer<typeof itemUpdateSchema>;

export const linkUpdateSchema = itemUpdateSchema.extend({ url: requiredUrlSchema });

export const itemCreateSchema = itemUpdateSchema.extend({
  type: z.enum(["snippet", "prompt", "command", "note", "link"]),
}).refine((input) => input.type !== "link" || Boolean(input.url), {
  path: ["url"], message: "URL is required for links.",
});

export type ItemCreateInput = z.infer<typeof itemCreateSchema>;
