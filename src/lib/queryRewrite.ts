/**
 * Query Rewrite — 用 LLM 将用户的自然语言问题改写为更适合向量检索的形式。
 *
 * 原理：用户口语化的提问（如"公司年假怎么算"）经过改写后
 * 变成更精准的检索查询（如"企业年假制度 计算规则 天数"），
 * 提升 embedding 检索的召回率。
 *
 * 面试要点：
 * - 这是 RAG 系统中常见的"查询理解"环节
 * - temperature=0 保证改写结果确定性
 * - 失败时降级返回原始问题，不影响主流程
 */

import { getAIClient, AI_MODEL } from "./ai-client";

const REWRITE_SYSTEM_PROMPT = `你是一个查询改写助手。将用户的自然语言问题改写为更适合向量检索的形式。

规则：
1. 提取关键概念和实体
2. 去除口语化表达、语气词
3. 补充同义词或相关术语，用空格分隔
4. 保留核心语义，不要改变问题的意图
5. 只输出改写后的查询文本，不要解释

示例：
输入：公司年假怎么算的啊
输出：企业年假制度 计算规则 休假天数`;

/**
 * 将用户问题改写为更适合向量检索的查询。
 * 失败时返回原始问题（降级策略）。
 */
export async function rewriteQuery(
  question: string,
  model?: string,
): Promise<{ rewritten: string; original: string }> {
  try {
    const client = getAIClient();
    const response = await client.chat.completions.create({
      model: model || AI_MODEL,
      messages: [
        { role: "system", content: REWRITE_SYSTEM_PROMPT },
        { role: "user", content: question },
      ],
      temperature: 0,
      max_tokens: 200,
    });

    const rewritten = response.choices[0]?.message?.content?.trim();

    // 改写结果为空或过短时降级
    if (!rewritten || rewritten.length < 2) {
      return { rewritten: question, original: question };
    }

    return { rewritten, original: question };
  } catch (err) {
    console.error("Query rewrite failed, falling back to original:", err);
    return { rewritten: question, original: question };
  }
}
