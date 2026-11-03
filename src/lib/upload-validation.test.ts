import { describe, expect, it } from "vitest";
import { uploadIntentSchema, uploadMime } from "./upload-validation";
import { verifyUploadContent } from "./upload-content";

const file = { type: "file" as const, fileName: "note.txt", size: 3, mime: "text/plain" };
describe("upload constraints", () => {
  it.each(["../note.txt", "a\\b.txt", "bad\n.txt", "a.exe"])("rejects unsafe or unsupported name %s", (fileName) => {
    expect(uploadIntentSchema.safeParse({ ...file, fileName }).success).toBe(false);
  });
  it("enforces exact type-specific binary size limits", () => {
    expect(uploadIntentSchema.safeParse({ ...file, size: 10 * 1024 * 1024 }).success).toBe(true);
    expect(uploadIntentSchema.safeParse({ ...file, size: 10 * 1024 * 1024 + 1 }).success).toBe(false);
    const image = { type: "image", fileName: "a.png", mime: "image/png", size: 5 * 1024 * 1024 };
    expect(uploadIntentSchema.safeParse(image).success).toBe(true);
    expect(uploadIntentSchema.safeParse({ ...image, size: image.size + 1 }).success).toBe(false);
  });
  it("rejects mismatched types and MIME labels; handles empty browser MIME", () => {
    expect(uploadIntentSchema.safeParse({ ...file, type: "image" }).success).toBe(false);
    expect(uploadIntentSchema.safeParse({ ...file, mime: "image/png" }).success).toBe(false);
    expect(uploadIntentSchema.safeParse({ ...file, mime: "" }).success).toBe(true);
    expect(uploadMime("config.YAML")).toBe("application/x-yaml");
  });
});
describe("content verification", () => {
  async function verify(text: string, name: string) {
    const bytes = new TextEncoder().encode(text);
    return verifyUploadContent(bytes, { ...file, fileName: name, size: bytes.length });
  }
  it("accepts UTF-8 text and text MIME aliases", async () => {
    await expect(verify("hello", "note.md")).resolves.toBe("text/markdown");
    await expect(verify('{"a":1}', "a.json")).resolves.toBe("application/json");
  });
  it.each([["not JSON", "a.json"], ["a = [", "a.toml"], ["a: [", "a.yaml"], ["<broken>", "a.xml"], ["<html/>", "a.svg"], ['<!DOCTYPE svg><svg/>', "a.svg"]])("rejects invalid structured content %s", async (text, name) => {
    await expect(verify(text, name)).rejects.toThrow();
  });
  it("accepts SVG only as verified downloadable content", async () => {
    await expect(verify('<svg xmlns="http://www.w3.org/2000/svg"/>', "a.svg")).resolves.toBe("image/svg+xml");
  });
  it("rejects spoofed binary content, non UTF-8 text and size mismatches", async () => {
    await expect(verify("fake PNG bytes", "a.png")).rejects.toThrow();
    await expect(verifyUploadContent(new Uint8Array([255, 255, 255]), file)).rejects.toThrow();
    await expect(verifyUploadContent(new Uint8Array([65]), file)).rejects.toThrow("size");
    await expect(verify("hello\0", "a.txt")).rejects.toThrow("Binary");
  });
});
