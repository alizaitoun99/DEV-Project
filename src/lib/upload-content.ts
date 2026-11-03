import "server-only";
import { fileTypeFromBuffer } from "file-type";
import { XMLValidator } from "fast-xml-parser";
import { parseDocument } from "yaml";
import { parse as parseToml } from "smol-toml";
import { uploadMime, type UploadIntent } from "@/lib/upload-validation";

/** Verify bytes independently of browser and Storage MIME metadata. */
export async function verifyUploadContent(bytes: Uint8Array, input: UploadIntent) {
  if (bytes.length !== input.size) throw new Error("Uploaded size does not match the selected file.");
  const extension = input.fileName.split(".").pop()!.toLowerCase();
  const expected = uploadMime(input.fileName);
  const detected = await fileTypeFromBuffer(bytes);
  if (["png", "jpg", "jpeg", "gif", "webp", "pdf"].includes(extension)) {
    if (detected?.mime !== expected) throw new Error("File contents do not match its extension.");
    return expected;
  }
  if (detected) throw new Error("Expected a UTF-8 text file.");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error("Binary data is not supported in text files.");
  if (extension === "json") JSON.parse(text);
  if (["yaml", "yml"].includes(extension) && parseDocument(text, { uniqueKeys: true }).errors.length) throw new Error("Invalid YAML file.");
  if (extension === "toml") parseToml(text);
  if (["xml", "svg"].includes(extension)) {
    if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) throw new Error("Invalid or unsupported XML.");
    if (extension === "svg" && !/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|\/?>)/i.test(text)) throw new Error("Expected SVG content.");
  }
  return expected;
}
