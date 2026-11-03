import { z } from "zod";

export class UploadError extends Error {}

export const uploadFormats: Record<string, string[]> = {
  png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"], gif: ["image/gif"],
  webp: ["image/webp"], svg: ["image/svg+xml"], pdf: ["application/pdf"],
  txt: ["text/plain"], md: ["text/markdown", "text/plain"], json: ["application/json", "text/plain"],
  yaml: ["application/x-yaml", "text/yaml", "application/yaml", "text/plain"],
  yml: ["application/x-yaml", "text/yaml", "application/yaml", "text/plain"],
  xml: ["application/xml", "text/xml", "text/plain"], csv: ["text/csv", "text/plain", "application/vnd.ms-excel"],
  toml: ["application/toml", "text/plain"], ini: ["text/plain"],
};
export const imageExtensions = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
export const uploadIntentSchema = z.object({
  type: z.enum(["file", "image"]),
  fileName: z.string().min(1).max(255).refine((name) => name.lastIndexOf(".") > 0 && !/[\x00-\x1f\x7f/\\]/.test(name), "Invalid filename or missing extension."),
  size: z.number().int().positive(),
  mime: z.string().max(150),
}).superRefine((input, ctx) => {
  const extension = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  const formats = uploadFormats[extension];
  if (!formats || imageExtensions.includes(extension) !== (input.type === "image")) {
    ctx.addIssue({ code: "custom", message: "Choose a supported format for this item type." });
  }
  if (formats && input.mime && !formats.includes(input.mime.toLowerCase())) {
    ctx.addIssue({ code: "custom", message: "File extension and content type do not match." });
  }
  if (input.size > (input.type === "image" ? 5 : 10) * 1024 * 1024) {
    ctx.addIssue({ code: "custom", message: `Maximum size is ${input.type === "image" ? 5 : 10} MB.` });
  }
});
export type UploadIntent = z.infer<typeof uploadIntentSchema>;

export function uploadMime(fileName: string) {
  return uploadFormats[fileName.split(".").pop()?.toLowerCase() ?? ""]?.[0] ?? "application/octet-stream";
}
