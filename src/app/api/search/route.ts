/**
 * ⭐ 面试亮点（/api/search + RunHistory）：
 * 1. 使用 JSONL 流式协议（step / sources / delta / error）返回 Agent 执行过程，前端可做可视化 Trace。
 * 2. 在流式回答结束后，将当前请求的 question / answer / RAG 参数（topK, threshold）/
 *    命中片段 / steps 全量写入 run_history 表，实现“运行历史 & 调试回放”能力。
 * 3. match_documents 的参数完全由前端透传（topK / threshold），体现对 RAG 调优的理解，
 *    也为后续 A/B、效果评估打基础。
 */

const DEFAULT_WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID!;

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getEmbeddings } from "@/lib/embedClient";
import { getAIClient, AI_MODEL } from "@/lib/ai-client";
import { getDemoWorkspaceIdOrThrow } from "@/lib/demoWorkspace";

export const runtime = "nodejs";

type HistoryItem = {
  role: "user" | "assistant";
  content: string;
};

type MatchRow = {
  id: number;
  document_id: number;
  content: string;
  similarity?: number;
  score?: number;
};

type StepStatus = "pending" | "running" | "done" | "error";

type StepLog = {
  id: string;
  title: string;
  status: StepStatus;
  detail?: string;
};

export async function POST(req: Request) {
  try {
    const { question, history, topK, threshold } = (await req.json()) as {
      question?: string;
      history?: HistoryItem[];
      topK?: number;
      threshold?: number;
    };

    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    const safeTopK =
      typeof topK === "number" && topK > 0 && topK <= 20 ? Math.floor(topK) : 5;
    const safeThreshold =
      typeof threshold === "number" && threshold >= 0 && threshold <= 1
        ? threshold
        : 0.4;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // ✅ requestId：用于把一次请求的所有日志串起来（排障利器）
        const requestId =
          globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

        // ✅ 分段计时器
        const t0 = Date.now();
        let ttfbMs: number | null = null;
        let embeddingMs: number | null = null;
        let retrieveMs: number | null = null;
        let llmMs: number | null = null;
        let bestSimilarity: number | null = null;
        let errorCode: string | null = null;
        let tokenUsage: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        } | null = null;
        let costUsd: number | null = null;
        let usageFromProvider: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        } | null = null;

        const estimateTokens = (text: string) =>
          Math.max(0, Math.ceil((text ?? "").length / 4));
        const normalizeUsage = (u: any) => {
          const prompt = Number(u?.prompt_tokens ?? 0);
          const completion = Number(u?.completion_tokens ?? 0);
          const total = Number.isFinite(Number(u?.total_tokens))
            ? Number(u?.total_tokens)
            : prompt + completion;
          return {
            prompt_tokens: Number.isFinite(prompt) ? prompt : 0,
            completion_tokens: Number.isFinite(completion) ? completion : 0,
            total_tokens: Number.isFinite(total) ? total : 0,
          };
        };

        // ✅ 结构化日志：先用 console.log，后面可无缝接入日志平台
        const log = (event: string, extra?: Record<string, any>) => {
          console.log(
            JSON.stringify({
              requestId,
              event,
              at: new Date().toISOString(),
              ...extra,
            }),
          );
        };
        const startTime = Date.now();

        // 💾 运行历史采集：在流式过程中逐步填充这些变量
        const stepsLog: StepLog[] = [];
        let sourcesForLog: MatchRow[] = [];
        let matchedCountForLog = 0;
        let answerForLog = "";

        const sendJSON = (obj: any) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        };

        const upsertStepLog = (step: StepLog) => {
          const idx = stepsLog.findIndex((s) => s.id === step.id);
          if (idx === -1) {
            stepsLog.push(step);
          } else {
            stepsLog[idx] = { ...stepsLog[idx], ...step };
          }
        };

        const sendStep = (
          id: string,
          title: string,
          status: StepStatus,
          detail?: string,
        ) => {
          const step: StepLog = { id, title, status, detail };
          upsertStepLog(step);
          sendJSON({ type: "step", data: step });
        };

        const flushRunHistory = async () => {
          try {
            const supabase = getSupabaseClient();
            const durationMs = Date.now() - startTime;
            await supabase.from("run_history").insert({
              question,
              answer: answerForLog || null,
              error_code: errorCode,
              token_usage: tokenUsage,
              cost_usd: costUsd,
              topk: safeTopK,
              threshold: safeThreshold,
              matched_count: matchedCountForLog,
              duration_ms: durationMs,
              // ✅ 新增 metrics
              request_id: requestId,
              ttfb_ms: ttfbMs,
              embedding_ms: embeddingMs,
              retrieve_ms: retrieveMs,
              llm_ms: llmMs,
              best_similarity: bestSimilarity,
              steps: stepsLog,
              sources: sourcesForLog,
            });
          } catch (e) {
            // ⚠️ 写 run_history 失败不能影响用户体验，所以只打日志不抛错
            console.error("❌ insert run_history error:", e);
          }
        };

        try {
          // Step 1：收到问题
          sendStep("received", "收到问题", "done", question);

          // Step 2：生成查询向量
          sendStep("embed", "生成查询向量", "running");
          const e0 = Date.now();

          const embeddings = getEmbeddings();
          const [queryVector] = await embeddings.embedDocuments([question]);

          embeddingMs = Date.now() - e0;
          log("embedding_done", { embeddingMs, dims: queryVector?.length });

          sendStep("embed", "生成查询向量", "done", `耗时 ${embeddingMs}ms`);

          // Step 3：检索相关文档片段（RAG）
          sendStep(
            "retrieve",
            "检索相关文档片段",
            "running",
            `topK=${safeTopK}, threshold=${safeThreshold}`,
          );

          const r0 = Date.now();
          const supabase = getSupabaseClient();

          // ✅ workspaceId：只保留一个来源，避免日志误导
          // 你现在已经有 demoWorkspace 逻辑，就用它；否则就用 env DEFAULT_WORKSPACE_ID。
          // 二选一，不要混着用。
          const workspaceId = getDemoWorkspaceIdOrThrow();
          // const workspaceId = DEFAULT_WORKSPACE_ID; // 如果你想完全用 env，就启用这一行并删掉上面那行

          log("retrieve_start", { workspaceId, safeTopK, safeThreshold });

          // ✅ RPC
          const { data: rawMatches, error } = await supabase.rpc(
            "match_documents",
            {
              query_embedding: queryVector,
              match_threshold: safeThreshold,
              match_count: safeTopK,
              p_workspace_id: workspaceId,
            },
          );

          retrieveMs = Date.now() - r0;
          log("retrieve_done", {
            retrieveMs,
            rawCount: Array.isArray(rawMatches) ? rawMatches.length : 0,
          });

          if (error) {
            sendStep("retrieve", "检索相关文档片段", "error", error.message);
            throw error;
          }

          /**
           * ✅ 关键：把 RPC 返回统一成“稳定的结构”
           * - similarity/score 统一转 number
           * - 过滤掉 NaN
           * - 再按相似度排序，保证 best 一定正确
           */
          const matches = ((rawMatches ?? []) as any[])
            .map((m) => {
              const sim = Number(m.similarity ?? m.score ?? 0);
              return {
                id: Number(m.id),
                document_id: Number(m.document_id),
                content: String(m.content ?? ""),
                similarity: Number.isFinite(sim) ? sim : 0,
              } as MatchRow;
            })
            .filter((m) => m.content.length > 0)
            .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

          // ✅ bestSimilarity：给后面 metrics / UI 用
          bestSimilarity = matches[0]?.similarity ?? null;

          matchedCountForLog = matches.length;
          sourcesForLog = matches;

          if (!matches.length) {
            sendStep("retrieve", "检索相关文档片段", "done", "未命中任何片段");
            const noAns = "文档中未提及相关信息。";
            answerForLog = noAns;
            tokenUsage = {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
            };
            costUsd = 0;
            sendJSON({ type: "delta", data: noAns });
            await flushRunHistory();
            controller.close();
            return;
          }

          // ✅ 如果 bestSimilarity 不是 number，就别 toFixed；先保证它是 number（上面已处理）
          const best = bestSimilarity ?? 0;

          if (best < safeThreshold) {
            sendStep(
              "retrieve",
              "检索相关文档片段",
              "done",
              `最高相似度=${best.toFixed(3)}，低于阈值(${safeThreshold})`,
            );
            const noAns = "文档中未提及相关信息。";
            answerForLog = noAns;
            tokenUsage = {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
            };
            costUsd = 0;
            sendJSON({ type: "delta", data: noAns });
            await flushRunHistory();
            controller.close();
            return;
          }

          sendStep(
            "retrieve",
            "检索相关文档片段",
            "done",
            `命中 ${matches.length} 条片段，最高相似度=${best.toFixed(3)}（耗时 ${retrieveMs ?? "-"}ms）`,
          );

          const context = matches.map((m) => m.content).join("\n---\n");

          // 把来源先发给前端
          sendJSON({ type: "sources", data: matches });

          // Step 3.5：模拟工具调用
          sendStep(
            "tool",
            "调用工具：searchDocs",
            "running",
            "基于向量检索结果进行处理",
          );
          try {
            await new Promise((r) => setTimeout(r, 200));
            sendStep(
              "tool",
              "调用工具：searchDocs",
              "done",
              `工具返回 ${matches.length} 条候选片段`,
            );
          } catch (toolErr: any) {
            sendStep(
              "tool",
              "调用工具：searchDocs",
              "error",
              toolErr?.message || "工具调用失败",
            );
          }

          const systemPrompt = `
你是一名企业知识问答助手，请根据提供的企业内部文档内容，用简洁、正式的中文回答问题。
如果文档中找不到答案，请直接回复：“文档中未提及相关信息。”，不要编造。
`;

          const historyMessages =
            history?.map((m) => ({
              role:
                m.role === "user" ? ("user" as const) : ("assistant" as const),
              content: m.content,
            })) ?? [];

          const currentUserMessage = {
            role: "user" as const,
            content: `请基于以下【文档内容】回答用户当前的问题。\n\n【文档内容】\n${context}\n\n【当前问题】\n${question}`,
          };
          const promptText = [
            systemPrompt,
            ...historyMessages.map((m) => m.content),
            currentUserMessage.content,
          ]
            .filter(Boolean)
            .join("\n");
          // Step 4：调用 LLM 生成回答
          sendStep("llm", "生成回答", "running");

          // ✅ LLM 计时开始
          const l0 = Date.now();

          const aiClient = getAIClient();

          const completion = await aiClient.chat.completions.create({
            model: AI_MODEL,
            stream: true,
            messages: [
              { role: "system", content: systemPrompt },
              ...historyMessages,
              currentUserMessage,
            ],
          });

          let currentContent = "";

          for await (const chunk of completion) {
            if ((chunk as any)?.usage) {
              usageFromProvider = (chunk as any).usage;
              log("usage_from_provider", { usage: usageFromProvider });
            }
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              // ✅ 只在第一次真正输出 token 时记录（更符合用户体感）
              if (ttfbMs == null) {
                ttfbMs = Date.now() - t0;
                log("first_token", { ttfbMs });
              }
              currentContent += delta;
              answerForLog = currentContent;
              sendJSON({ type: "delta", data: delta });
            }
          }

          // ✅ LLM 计时结束
          llmMs = Date.now() - l0;
          log("llm_done", { llmMs });

          if (usageFromProvider) {
            tokenUsage = normalizeUsage(usageFromProvider);
          } else {
            log("usage_missing_fallback_estimate");
            const promptTokens = estimateTokens(promptText);
            const completionTokens = estimateTokens(currentContent);
            const totalTokens = promptTokens + completionTokens;
            tokenUsage = {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              total_tokens: totalTokens,
            };
          }
          const totalTokens = tokenUsage?.total_tokens ?? 0;
          const rate = Number(process.env.AI_COST_PER_1K_TOKENS);
          costUsd = Number.isFinite(rate)
            ? Number(((totalTokens / 1000) * rate).toFixed(6))
            : null;

          sendStep("llm", "生成回答", "done", `耗时 ${llmMs}ms`);
          await flushRunHistory();
          controller.close();
        } catch (err: any) {
          console.error("❌ Search error in stream:", err);
          errorCode = err?.code || err?.name || err?.status || "SERVER_ERROR";
          sendStep(
            "error",
            "服务端出错",
            "error",
            err?.message || "Unknown error",
          );
          sendJSON({
            type: "error",
            data: err?.message || "Server error",
          });
          await flushRunHistory();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (err: any) {
    console.error("❌ Search error (outer):", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}
