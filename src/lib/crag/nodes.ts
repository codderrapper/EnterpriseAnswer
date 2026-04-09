// src/lib/crag/nodes.ts
import type { RunnableConfig } from "@langchain/core/runnables";
import type { CragState, GradedChunk, Decision, SendFn, NodeOutputSummary } from "./types";
import { getAIClient, AI_MODEL } from "@/lib/ai-client";
import { getEmbeddings } from "@/lib/embedClient";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getDemoWorkspaceIdOrThrow } from "@/lib/demoWorkspace";
import { rewriteQuery } from "@/lib/queryRewrite";

// ─── retrieve ────────────────────────────────────────────────────────────────

export async function retrieveNode(
  state: CragState,
  config: RunnableConfig,
): Promise<Partial<CragState>> {
  const send = (config.configurable?.send ?? (() => {})) as SendFn;
  send({ type: "node_started", node: "retrieve", ts: Date.now() });

  const supabase = getSupabaseClient();
  const embeddings = getEmbeddings();
  const workspaceId = getDemoWorkspaceIdOrThrow();

  const [embedding] = await embeddings.embedDocuments([state.activeQuery]);
  const { data: docs } = await supabase.rpc("match_documents", {
    query_embedding: embedding,
    match_threshold: state.threshold,
    match_count: state.topK,
    p_workspace_id: workspaceId,
  });

  const retrievedDocs = (docs ?? []).map((d: {
    id: number; content: string; document_id: number; similarity: number;
  }) => ({
    id: String(d.id),
    content: d.content,
    metadata: { documentId: d.document_id, similarity: d.similarity },
  }));

  const summary: NodeOutputSummary = {
    node: "retrieve",
    count: retrievedDocs.length,
    topSimilarity: (retrievedDocs[0]?.metadata?.similarity as number) ?? 0,
  };
  send({ type: "node_completed", node: "retrieve", ts: Date.now(), data: summary });

  return { retrievedDocs };
}

// ─── gradeDocuments ───────────────────────────────────────────────────────────

const GRADE_SYSTEM_PROMPT = `你是一个文档相关性评估助手。
给定用户问题和若干文档片段，判断每个片段与问题的相关程度。

输出严格 JSON（不要 markdown）：
{
  "grades": [
    { "id": "<chunk_id>", "relevance": "relevant|partial|irrelevant", "confidence": 0.0-1.0, "reason": "<一句话理由>" }
  ]
}

relevance 含义：
- relevant: 直接包含答案所需信息
- partial: 部分相关，可能有用
- irrelevant: 与问题无关`;

export async function gradeDocumentsNode(
  state: CragState,
  config: RunnableConfig,
): Promise<Partial<CragState>> {
  const send = (config.configurable?.send ?? (() => {})) as SendFn;
  send({ type: "node_started", node: "gradeDocuments", ts: Date.now() });

  // No docs or max retries reached — skip LLM call, go straight to fallback
  if (state.retrievedDocs.length === 0 || state.retryCount >= 2) {
    const decision: Decision = {
      route: "fallback",
      reason: state.retryCount >= 2 ? "已达最大重试次数" : "无检索结果",
    };
    const summary: NodeOutputSummary = {
      node: "gradeDocuments", relevant: 0, partial: 0, irrelevant: 0, route: "fallback",
    };
    send({ type: "node_completed", node: "gradeDocuments", ts: Date.now(), data: summary });
    return { gradedDocs: [], selectedDocs: [], decision };
  }

  const chunksText = state.retrievedDocs
    .map(c => `[${c.id}] ${c.content.slice(0, 300)}`)
    .join("\n\n");

  const response = await getAIClient().chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: GRADE_SYSTEM_PROMPT },
      { role: "user", content: `问题：${state.activeQuery}\n\n文档片段：\n${chunksText}` },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  let grades: Array<{ id: string; relevance: string; confidence: number; reason: string }> = [];
  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    grades = Array.isArray(parsed.grades) ? parsed.grades : [];
  } catch {
    grades = state.retrievedDocs.map(c => ({
      id: c.id, relevance: "irrelevant", confidence: 0, reason: "评分解析失败",
    }));
  }

  const gradedDocs: GradedChunk[] = state.retrievedDocs.map(chunk => {
    const grade = grades.find(g => g.id === chunk.id);
    return {
      ...chunk,
      relevance: (grade?.relevance as GradedChunk["relevance"]) ?? "irrelevant",
      confidence: grade?.confidence ?? 0,
      reason: grade?.reason ?? "",
    };
  });

  const relevantCount = gradedDocs.filter(d => d.relevance === "relevant").length;
  const partialCount  = gradedDocs.filter(d => d.relevance === "partial").length;

  let route: Decision["route"];
  if (relevantCount >= 1 || partialCount >= 2) {
    route = "generate";
  } else if (state.retryCount < 2) {
    route = "rewrite";
  } else {
    route = "fallback";
  }

  // relevant all selected; partial fills in if relevant < 2
  const selectedDocs = [
    ...gradedDocs.filter(d => d.relevance === "relevant"),
    ...(relevantCount < 2 ? gradedDocs.filter(d => d.relevance === "partial") : []),
  ];

  const decision: Decision = {
    route,
    reason: `${relevantCount} relevant, ${partialCount} partial`,
  };

  const summary: NodeOutputSummary = {
    node: "gradeDocuments",
    relevant: relevantCount,
    partial: partialCount,
    irrelevant: gradedDocs.length - relevantCount - partialCount,
    route,
  };
  send({ type: "node_completed", node: "gradeDocuments", ts: Date.now(), data: summary });

  return { gradedDocs, selectedDocs, decision };
}

// ─── rewriteQuery ─────────────────────────────────────────────────────────────

export async function rewriteQueryNode(
  state: CragState,
  config: RunnableConfig,
): Promise<Partial<CragState>> {
  const send = (config.configurable?.send ?? (() => {})) as SendFn;
  send({ type: "node_started", node: "rewriteQuery", ts: Date.now() });

  const { rewritten } = await rewriteQuery(state.activeQuery);

  const summary: NodeOutputSummary = {
    node: "rewriteQuery", original: state.activeQuery, rewritten,
  };
  send({ type: "edge_taken", from: "rewriteQuery", to: "retrieve", reason: `重试第 ${state.retryCount + 1} 次` });
  send({ type: "node_completed", node: "rewriteQuery", ts: Date.now(), data: summary });

  // IMPORTANT: return [rewritten] not [...state.queryHistory, rewritten]
  // The CragStateAnnotation reducer for queryHistory is append-mode:
  // reducer(existing, [rewritten]) => [...existing, rewritten]
  // Returning the full array would cause duplicates.
  return {
    activeQuery: rewritten,
    queryHistory: [rewritten],
    retryCount: state.retryCount + 1,
  };
}

// ─── generate ─────────────────────────────────────────────────────────────────

const GENERATE_SYSTEM_PROMPT = `你是企业知识库助手。请根据以下文档内容回答用户问题。
要求：
- 只使用文档中的信息，不要凭空推测
- 回答简洁、准确
- 如果文档内容不足以完整回答，请说明`;

export async function generateNode(
  state: CragState,
  config: RunnableConfig,
): Promise<Partial<CragState>> {
  const send = (config.configurable?.send ?? (() => {})) as SendFn;
  send({ type: "node_started", node: "generate", ts: Date.now() });

  const context = state.selectedDocs.map(d => d.content).join("\n---\n");
  const systemPrompt = `${GENERATE_SYSTEM_PROMPT}\n\n【文档内容】\n${context}`;

  const completion = await getAIClient().chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: state.originalQuestion },
    ],
    stream: true,
  });

  let answer = "";
  for await (const chunk of completion) {
    const token = chunk.choices[0]?.delta?.content ?? "";
    if (token) {
      answer += token;
      send({ type: "token", value: token });
    }
  }

  const summary: NodeOutputSummary = { node: "generate", tokens: answer.length };
  send({ type: "node_completed", node: "generate", ts: Date.now(), data: summary });

  return { answer };
}

// ─── fallback ─────────────────────────────────────────────────────────────────

export async function fallbackNode(
  state: CragState,
  config: RunnableConfig,
): Promise<Partial<CragState>> {
  const send = (config.configurable?.send ?? (() => {})) as SendFn;
  send({ type: "node_started", node: "fallback", ts: Date.now() });

  const message = `知识库中未找到与「${state.originalQuestion}」足够相关的内容（已重试 ${state.retryCount} 次）。建议：换个角度描述问题，或上传相关文档后重试。`;

  const summary: NodeOutputSummary = {
    node: "fallback", reason: "low_relevance_after_retries", retryCount: state.retryCount,
  };
  send({ type: "node_completed", node: "fallback", ts: Date.now(), data: summary });

  return { fallbackMessage: message, answer: message };
}
