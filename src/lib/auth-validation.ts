import { z } from "zod";
import { normalizeEmail } from "@/lib/email";

const passwordSchema = z.string().min(8, "Password must contain at least 8 characters.")
  .max(72, "Password must be at most 72 bytes.")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Password must be at most 72 bytes.");

export const credentialsSchema = z.object({
  email: z.string().transform(normalizeEmail).pipe(z.string().max(254).email("Enter a valid email address.")),
  password: passwordSchema,
});

export const forgotPasswordSchema = credentialsSchema.pick({ email: true });
export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, "Invalid reset link. Request a new one."),
  password: passwordSchema,
  confirmPassword: z.string().max(72),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export const registrationSchema = credentialsSchema.extend({
  name: z.string().trim().min(1, "Name is required.").max(100),
  confirmPassword: z.string().max(72),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});
