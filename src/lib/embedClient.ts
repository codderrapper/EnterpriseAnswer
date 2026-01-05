// src/lib/embedClient.ts
import { OpenAIEmbeddings } from "@langchain/openai";

let _embeddings: OpenAIEmbeddings | null = null;

export function getEmbeddings(): OpenAIEmbeddings {
  if (_embeddings) return _embeddings;

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing AI_API_KEY for embeddings. Set AI_API_KEY (and optional AI_BASE_URL)."
    );
  }

  const baseURL = process.env.AI_BASE_URL;

  _embeddings = new OpenAIEmbeddings({
    model: process.env.AI_EMBEDDING_MODEL || "netease-youdao/bce-embedding-base_v1",
    apiKey,
    // LangChain OpenAIEmbeddings 支持 configuration.baseURL（你原来这么写的）
    configuration: baseURL ? { baseURL } : undefined,
  });

  return _embeddings;
}
