// PHASE 2: LLM INTEGRATION POINT
import OpenAI from "openai";

let cachedClient: OpenAI | null | undefined;

export function getOpenAIApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key ? key : null;
}

export function hasOpenAIKey(): boolean {
  return Boolean(getOpenAIApiKey());
}

export function getOpenAIClient(): OpenAI | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}
