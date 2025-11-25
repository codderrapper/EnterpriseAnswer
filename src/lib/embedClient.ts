// src/lib/embedClient.ts
import { OpenAIEmbeddings } from "@langchain/openai";

export const embeddings = new OpenAIEmbeddings({
  model: "netease-youdao/bce-embedding-base_v1",
  apiKey: process.env.AI_API_KEY!,
  configuration: {
    baseURL: process.env.AI_BASE_URL,
  },
});
