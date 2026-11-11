import "server-only";

import OpenAI from "openai";

export const AI_MODEL = "gpt-6-luna";

let client: OpenAI | undefined;

export function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for AI features.");
  return client ??= new OpenAI({ apiKey, timeout: 15000, maxRetries: 0 });
}
