/**
 * LLM-based Reranker — 用大模型对向量检索结果重新打分排序。
 *
 * 原理：向量检索（bi-encoder）速度快但精度有限，
 * 用 LLM 做 pointwise 评分（类似 cross-encoder）可以提升排序质量。
 * 先用向量粗召回 topK 个候选，再用 LLM 精排，取最相关的结果。
 *
 * 面试要点：
 * - 这是 two-stage retrieval 架构：粗召回 + 精排
 * - 生产环境可用 Cohere Rerank API 或 cross-encoder 模型替代
 * - 当前方案用已有 LLM 做 rerank，零额外依赖
 * - JSON 解析失败时降级保留原始排序
 */

import { getAIClient, AI_MODEL } from "./ai-client";

export type RerankItem = {
  id: number;
  document_id: number;
  content: string;
  similarity?: number;
  relevanceScore?: number;
};

const RERANK_SYSTEM_PROMPT = `你是一个文档相关性评分助手。给定一个问题和多个文档片段，请为每个片段评估与问题的相关性。

评分标准（0-10）：
- 9-10：直接回答了问题
- 6-8：包含相关信息，有助于回答
- 3-5：主题相关但未直接涉及
- 0-2：不相关

只输出 JSON 数组，格式：[{"index":0,"score":8},{"index":1,"score":3}]
不要输出任何其他内容。`;

/**
 * 对检索到的文档片段进行 LLM 重排序。
 * 返回按相关性得分从高到低排列的片段。
 * 解析失败时降级返回原始顺序。
 */
export async function rerankChunks(
  question: string,
  chunks: RerankItem[],
  model?: string,
): Promise<RerankItem[]> {
  if (chunks.length <= 1) return chunks;

  try {
    const client = getAIClient();

    // 构建片段文本，每个片段截取前 200 字符避免 token 过多
    const chunksText = chunks
      .map((c, i) => `[片段${i}] ${c.content.slice(0, 200)}`)
      .join("\n\n");

    const response = await client.chat.completions.create({
      model: model || AI_MODEL,
      messages: [
        { role: "system", content: RERANK_SYSTEM_PROMPT },
        { role: "user", content: `问题：${question}\n\n${chunksText}` },
      ],
      temperature: 0,
      max_tokens: 500,
    });

    const text = response.choices[0]?.message?.content?.trim() || "";

    // 解析 LLM 返回的 JSON 评分
    const scores: Array<{ index: number; score: number }> = JSON.parse(text);

    // 将评分映射回 chunks
    const scored = chunks.map((chunk, i) => {
      const found = scores.find((s) => s.index === i);
      return {
        ...chunk,
        relevanceScore: found?.score ?? 0,
      };
    });

    // 按相关性得分降序排列
    return scored.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
  } catch (err) {
    // JSON 解析失败或 LLM 调用失败，降级返回原始排序
    console.error("Rerank failed, falling back to original order:", err);
    return chunks;
  }
}
