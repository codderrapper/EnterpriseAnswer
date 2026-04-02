import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getEmbeddings } from "@/lib/embedClient";
import { getAIClient, AI_MODEL } from "@/lib/ai-client";
import { getDemoWorkspaceIdOrThrow } from "@/lib/demoWorkspace";
import {
  buildSearchCacheKey,
  enforceSearchRateLimit,
  getCachedSearchAnswer,
  setCachedSearchAnswer,
} from "@/lib/runtimeGuards";
import {
  DEFAULT_SYSTEM_PROMPT,
  getActivePromptTemplate,
  getPromptTemplateByVersion,
} from "@/lib/promptTemplate";

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
    const {
      question,
      history,
      topK,
      threshold,
      model,
      promptVersion,
      rewrite,
      rerank,
    } = (await req.json()) as {
      question?: string;
      history?: HistoryItem[];
      topK?: number;
      threshold?: number;
      model?: string;
      promptVersion?: number;
      rewrite?: boolean;
      rerank?: boolean;
    };

    if (!question?.trim()) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    const workspaceId = getDemoWorkspaceIdOrThrow();
    const limit = enforceSearchRateLimit(workspaceId);
    if (!limit.ok) {
      return NextResponse.json(
        { error: limit.message, errorCode: limit.errorCode },
        { status: 429 },
      );
    }

    const safeTopK =
      typeof topK === "number" && topK > 0 && topK <= 20 ? Math.floor(topK) : 5;
    const safeThreshold =
      typeof threshold === "number" && threshold >= 0 && threshold <= 1
        ? threshold
        : 0.4;
    const safeModel = typeof model === "string" && model.trim() ? model.trim() : AI_MODEL;
    const safePromptVersion =
      typeof promptVersion === "number" && Number.isFinite(promptVersion)
        ? Math.floor(promptVersion)
        : null;
    const useRewrite = Boolean(rewrite);
    const useRerank = Boolean(rerank);

    const cacheKey = buildSearchCacheKey({
      workspaceId,
      question,
      topK: safeTopK,
      threshold: safeThreshold,
      model: safeModel,
      promptVersion: safePromptVersion,
      rewrite: useRewrite,
      rerank: useRerank,
    });

    const cached = getCachedSearchAnswer(cacheKey);
    if (cached) {
      const encoder = new TextEncoder();
      const cachedStream = new ReadableStream({
        start(controller) {
          const sendJSON = (obj: unknown) => {
            controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
          };

          sendJSON({
            type: "step",
            data: {
              id: "cache",
              title: "缓存命中",
              status: "done",
              detail: "1 分钟内相同问题直接返回",
            },
          });
          sendJSON({ type: "sources", data: cached.sources });
          sendJSON({ type: "delta", data: cached.answer });
          controller.close();
        },
      });

      return new Response(cachedStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Cache": "HIT",
        },
      });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const requestId =
          globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

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

        const estimateTokens = (text: string) => Math.max(0, Math.ceil((text ?? "").length / 4));
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
            console.error("❌ insert run_history error:", e);
          }
        };

        try {
          sendStep("received", "收到问题", "done", question);

          sendStep("embed", "生成查询向量", "running");
          const e0 = Date.now();

          let queryVector: number[];
          try {
            const embeddings = getEmbeddings();
            const [vector] = await embeddings.embedDocuments([question]);
            queryVector = vector;
            embeddingMs = Date.now() - e0;
            log("embedding_done", { embeddingMs, dims: queryVector?.length });
            sendStep("embed", "生成查询向量", "done", `耗时 ${embeddingMs}ms`);
          } catch (err: any) {
            errorCode = "EMBEDDING_ERROR";
            sendStep("embed", "生成查询向量", "error", err?.message || "embedding failed");
            throw err;
          }

          sendStep(
            "retrieve",
            "检索相关文档片段",
            "running",
            `topK=${safeTopK}, threshold=${safeThreshold}`,
          );

          const r0 = Date.now();
          let rawMatches: any[] | null = null;
          try {
            const supabase = getSupabaseClient();
            log("retrieve_start", { workspaceId, safeTopK, safeThreshold });
            const { data, error } = await supabase.rpc("match_documents", {
              query_embedding: queryVector,
              match_threshold: safeThreshold,
              match_count: safeTopK,
              p_workspace_id: workspaceId,
            });

            if (error) throw error;
            rawMatches = (data ?? []) as any[];
            retrieveMs = Date.now() - r0;
            log("retrieve_done", { retrieveMs, rawCount: rawMatches.length });
          } catch (err: any) {
            errorCode = "RETRIEVE_ERROR";
            sendStep("retrieve", "检索相关文档片段", "error", err?.message || "retrieve failed");
            throw err;
          }

          let matches = (rawMatches ?? [])
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

          if (useRewrite) {
            sendStep("rewrite", "查询改写", "running", "启用 rewrite=true");
            sendStep("rewrite", "查询改写", "done", "当前版本仅记录参数，保留原始问题");
          }

          if (useRerank) {
            sendStep("rerank", "结果重排", "running", "启用 rerank=true");
            matches = [...matches].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
            sendStep("rerank", "结果重排", "done", "按相似度进行重排");
          }

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
          sendJSON({ type: "sources", data: matches });

          sendStep("tool", "调用工具：searchDocs", "running", "基于向量检索结果进行处理");
          await new Promise((r) => setTimeout(r, 120));
          sendStep("tool", "调用工具：searchDocs", "done", `工具返回 ${matches.length} 条候选片段`);

          let systemPrompt = DEFAULT_SYSTEM_PROMPT;
          let promptVersionUsed: number | null = null;

          sendStep("prompt", "加载 Prompt 模板", "running");
          try {
            const template = safePromptVersion
              ? await getPromptTemplateByVersion(safePromptVersion)
              : await getActivePromptTemplate("search_system");

            if (template?.content?.trim()) {
              systemPrompt = template.content.trim();
              promptVersionUsed = template.version;
              sendStep(
                "prompt",
                "加载 Prompt 模板",
                "done",
                `version=${template.version}${template.is_active ? "(active)" : ""}`,
              );
            } else {
              sendStep("prompt", "加载 Prompt 模板", "done", "未找到模板，使用默认 Prompt");
            }
          } catch (err: any) {
            sendStep(
              "prompt",
              "加载 Prompt 模板",
              "error",
              err?.message || "读取模板失败，回退默认 Prompt",
            );
            log("prompt_template_error", { message: err?.message });
          }

          const historyMessages =
            history?.map((m) => ({
              role: m.role === "user" ? ("user" as const) : ("assistant" as const),
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

          sendStep("llm", "生成回答", "running", `model=${safeModel}`);
          const l0 = Date.now();

          let currentContent = "";
          try {
            const aiClient = getAIClient();
            const completion = await aiClient.chat.completions.create({
              model: safeModel,
              stream: true,
              messages: [
                { role: "system", content: systemPrompt },
                ...historyMessages,
                currentUserMessage,
              ],
            });

            for await (const chunk of completion) {
              if ((chunk as any)?.usage) {
                usageFromProvider = (chunk as any).usage;
                log("usage_from_provider", { usage: usageFromProvider });
              }

              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) {
                if (ttfbMs == null) {
                  ttfbMs = Date.now() - t0;
                  log("first_token", { ttfbMs });
                }
                currentContent += delta;
                answerForLog = currentContent;
                sendJSON({ type: "delta", data: delta });
              }
            }
          } catch (err: any) {
            errorCode = "LLM_ERROR";
            sendStep("llm", "生成回答", "error", err?.message || "llm failed");
            throw err;
          }

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

          sendStep(
            "llm",
            "生成回答",
            "done",
            `耗时 ${llmMs}ms · promptVersion=${promptVersionUsed ?? "default"}`,
          );

          if (currentContent.trim()) {
            setCachedSearchAnswer(cacheKey, {
              answer: currentContent,
              sources: matches,
              model: safeModel,
              promptVersion: promptVersionUsed,
            });
          }

          await flushRunHistory();
          controller.close();
        } catch (err: any) {
          console.error("❌ Search error in stream:", err);
          if (!errorCode) errorCode = "SERVER_ERROR";

          sendStep("error", "服务端出错", "error", err?.message || "Unknown error");
          sendJSON({
            type: "error",
            data: err?.message || "Server error",
            code: errorCode,
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
      { error: err?.message || "Server error", errorCode: "SERVER_ERROR" },
      { status: 500 },
    );
  }
}
