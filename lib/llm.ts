import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createGoogleGenerativeAI, google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

const provider = (process.env.LLM_PROVIDER?.trim().toLowerCase() || "gemini");

function buildGeminiModel(): LanguageModel {
  const modelId = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim();
  const geminiProvider = apiKey
    ? createGoogleGenerativeAI({ apiKey })
    : google;
  return geminiProvider(modelId);
}

function buildBedrockModel(): LanguageModel {
  const modelId =
    process.env.BEDROCK_MODEL_ID?.trim() ||
    "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
  const region =
    process.env.AWS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim() ||
    "us-east-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const sessionToken = process.env.AWS_SESSION_TOKEN?.trim();
  const bedrock = createAmazonBedrock({
    region,
    ...(accessKeyId ? { accessKeyId } : {}),
    ...(secretAccessKey ? { secretAccessKey } : {}),
    ...(sessionToken ? { sessionToken } : {}),
  });
  return bedrock(modelId);
}

export const llmModel: LanguageModel =
  provider === "bedrock" ? buildBedrockModel() : buildGeminiModel();
