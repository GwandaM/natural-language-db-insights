import { createGoogleGenerativeAI, google } from "@ai-sdk/google";

const modelId = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

const geminiApiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
  process.env.GEMINI_API_KEY?.trim();

const geminiProvider = geminiApiKey
  ? createGoogleGenerativeAI({ apiKey: geminiApiKey })
  : google;

export const llmModel = geminiProvider(modelId);
