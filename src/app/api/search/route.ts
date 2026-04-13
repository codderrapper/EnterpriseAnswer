// @deprecated: This route is being phased out. New code should use /api/chat instead.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { resolveWorkspaceId } from "@/lib/workspace";
import { getEmbeddings } from "@/lib/embedClient";
import { getAIClient, AI_MODEL } from "@/lib/ai-client";
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
import { rewriteQuery } from "@/lib/queryRewrite";
import { rerankChunks } from "@/lib/reranker";

export const runtime = "nodejs";

/** Zod schema：声明式定义 /api/search 接受的参数及校验规则 */
const SearchInputSchema = z.object({
  question: z.string().min(1, "Missing question"),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional(),
  topK: z.number().int().min(1).max(20).nullish(),
  threshold: z.number().min(0).max(1).nullish(),
  model: z.string().trim().min(1).optional(),
  promptVersion: z.number().int().finite().nullish(),
  rewrite: z.boolean().default(false),
  rerank: z.boolean().default(false),
});

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
    // Zod 一行完成参数校验 + 默认值填充 + 类型推导
    const parsed = SearchInputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const {
      question,
      history,
      topK,
      threshold,
      model,
      promptVersion: safePromptVersion,
      rewrite: useRewrite,
      rerank: useRerank,
    } = parsed.data;

    const supabase = await getSupabaseServerClient();

    // ── 企业级特性：策略驱动参数 ──
    // 优先加载 Strategy (Prompt Template)，获取其绑定的最优参数
    const template = safePromptVersion
      ? await getPromptTemplateByVersion(safePromptVersion)
      : await getActivePromptTemplate("search_system");

    // 参数优先级：请求显式传参 > 策略绑定参数 > 系统硬编码默认值
    const safeTopK = topK ?? template?.top_k ?? 5;
    const safeThreshold = threshold ?? template?.threshold ?? 0.4;
    const safeModel = model ?? AI_MODEL;

    const workspaceId = await resolveWorkspaceId(supabase);
    const limit = enforceSearchRateLimit(workspaceId);
    if (!limit.ok) {
      return NextResponse.json(
        { error: limit.message, errorCode: limit.errorCode },
        { status: 429 },
      );
    }

    const cacheKey = buildSearchCacheKey({
      workspaceId,
      question,
      topK: safeTopK,
      threshold: safeThreshold,
      model: safeModel,
      promptVersion: safePromptVersion ?? null,
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

          // ── Query Rewrite：用 LLM 改写问题，提升检索召回率 ──
          let searchQuery = question; // 检索用的查询（可能被改写）
          if (useRewrite) {
            sendStep("rewrite", "查询改写", "running", "用 LLM 改写问题以提升检索质量");
            try {
              const rw0 = Date.now();
              const { rewritten } = await rewriteQuery(question, safeModel);
              const rwMs = Date.now() - rw0;
              searchQuery = rewritten;
              log("rewrite_done", { rwMs, original: question, rewritten });
              sendStep("rewrite", "查询改写", "done",
                `耗时 ${rwMs}ms · 改写为：${rewritten.slice(0, 80)}`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "rewrite failed";
              log("rewrite_error", { message: msg });
              sendStep("rewrite", "查询改写", "error", `${msg}，使用原始问题`);
              // 降级：继续使用原始问题
            }
          }

          sendStep("embed", "生成查询向量", "running");
          const e0 = Date.now();

          let queryVector: number[];
          try {
            const embeddings = getEmbeddings();
            // 用 searchQuery 做 embedding（如果开启了 rewrite，这里用的是改写后的查询）
            const [vector] = await embeddings.embedDocuments([searchQuery]);
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

          // ── Rerank：用 LLM 对检索结果重新打分排序 ──
          if (useRerank) {
            sendStep("rerank", "结果重排", "running", "用 LLM 对候选片段重新评分");
            try {
              const rr0 = Date.now();
              const reranked = await rerankChunks(question, matches, safeModel);
              const rrMs = Date.now() - rr0;
              matches = reranked;
              // 重排后更新最高分
              bestSimilarity = matches[0]?.similarity ?? bestSimilarity;
              log("rerank_done", { rrMs, count: matches.length });
              sendStep("rerank", "结果重排", "done",
                `耗时 ${rrMs}ms · 重排 ${matches.length} 个片段`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "rerank failed";
              log("rerank_error", { message: msg });
              sendStep("rerank", "结果重排", "error", `${msg}，保留原始排序`);
              // 降级：保留向量检索的原始排序
            }
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

          let systemPrompt = DEFAULT_SYSTEM_PROMPT;
          let promptVersionUsed: number | null = null;

          sendStep("prompt", "应用策略配置", "running");
          if (template?.content?.trim()) {
            systemPrompt = template.content.trim();
            promptVersionUsed = template.version;
            sendStep(
              "prompt",
              "应用策略配置",
              "done",
              `已载入策略 v${template.version} (Threshold: ${safeThreshold})`,
            );
          } else {
            sendStep("prompt", "应用策略配置", "done", "使用系统默认策略");
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
