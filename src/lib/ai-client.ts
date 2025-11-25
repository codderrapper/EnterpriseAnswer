// src/lib/ai-client.ts
import OpenAI from "openai";

type Provider = "openai" | "siliconflow" | "zhipu";

const provider = (process.env.AI_PROVIDER as Provider) || "openai";

// 不同平台的默认配置
const PROVIDER_CONFIG = {
  openai: {
    baseURL: "https://api.openai.com/v1",
    model: process.env.AI_MODEL || "gpt-4o-mini",
  },
  siliconflow: {
    baseURL: "https://api.siliconflow.cn/v1",
    model: process.env.AI_MODEL || "gpt-4o-mini",
  },
  zhipu: {
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    model: process.env.AI_MODEL || "glm-4",
  },
};

const config = PROVIDER_CONFIG[provider];

if (!process.env.AI_API_KEY) {
  console.warn("⚠️  缺少 AI_API_KEY 环境变量，请在 .env.local 中设置。");
}

export const aiClient = new OpenAI({
  apiKey: process.env.AI_API_KEY!,
  baseURL: process.env.AI_BASE_URL || config.baseURL,
});

export const AI_MODEL = config.model;
export const AI_PROVIDER = provider;

console.log(`🧠 Using ${provider.toUpperCase()} model: ${config.model}`);
