import { z } from "zod";

export const resourceIdSchema = z.string().trim().min(1).max(200);
