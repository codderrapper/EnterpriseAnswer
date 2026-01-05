// src/lib/ai-client.ts
import OpenAI from "openai";

export type Provider = "openai" | "siliconflow" | "zhipu";

// ✅ 注意：不要在模块顶层读取 env 并做会 throw 的事（CI/build 会 import）
// 这些读取是“纯字符串”，不触发网络，也不 new client，安全。
const provider = (process.env.AI_PROVIDER as Provider) || "openai";

const PROVIDER_CONFIG: Record<Provider, { baseURL: string; model: string }> = {
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

// ✅ 这些导出是“纯配置”，不会触发 client 初始化
export const AI_MODEL = config.model;
export const AI_PROVIDER = provider;

let _client: OpenAI | null = null;

export function getAIClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.AI_API_KEY; // 你现在统一用 AI_API_KEY

  if (!apiKey) {
    // ✅ 运行时才抛错：CI/build import 不会触发
    throw new Error(
      "Missing credentials: set AI_API_KEY (and optional AI_BASE_URL / AI_PROVIDER / AI_MODEL)."
    );
  }

  const baseURL = process.env.AI_BASE_URL || config.baseURL;

  _client = new OpenAI({
    apiKey,
    baseURL,
  });

  return _client;
}
