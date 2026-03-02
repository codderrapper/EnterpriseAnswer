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
              topk: safeTopK,
              threshold: safeThreshold,
              matched_count: matchedCountForLog,
              duration_ms: durationMs,
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
          const embeddings = getEmbeddings();

          const [queryVector] = await embeddings.embedDocuments([question]);
          console.log("queryVector length:", queryVector.length);
          sendStep("embed", "生成查询向量", "done");

          // Step 3：检索相关文档片段（RAG）
          sendStep(
            "retrieve",
            "检索相关文档片段",
            "running",
            `topK=${safeTopK}, threshold=${safeThreshold}`,
          );
          const supabase = getSupabaseClient();
          console.log("RPC payload", JSON.stringify(DEFAULT_WORKSPACE_ID));
          const workspaceId = getDemoWorkspaceIdOrThrow();
          const { data: rawMatches, error } = await supabase.rpc(
            "match_documents",
            {
              query_embedding: queryVector,
              match_threshold: safeThreshold,
              match_count: safeTopK,
              p_workspace_id: workspaceId, // ✅ 新增
            },
          );
          console.log("rawMatches:", rawMatches);
          console.log("workspaceId passed to rpc:", DEFAULT_WORKSPACE_ID);
          console.log("queryVector first 5:", queryVector.slice(0, 5));
          if (error) {
            sendStep("retrieve", "检索相关文档片段", "error", error.message);
            throw error;
          }

          // const matches = (rawMatches ?? []) as MatchRow[];
          const matches = (rawMatches ?? []) as MatchRow[];

          const best = matches[0]?.similarity ?? -999;

          matchedCountForLog = matches.length;
          sourcesForLog = matches;

          if (!matches.length || best < safeThreshold) {
            sendStep(
              "retrieve",
              "检索相关文档片段",
              "done",
              `最高相似度=${best.toFixed(3)}，低于阈值`,
            );
            const noAns = "文档中未提及相关信息。";
            answerForLog = noAns;
            sendJSON({
              type: "delta",
              data: noAns,
            });
            await flushRunHistory();
            controller.close();
            return;
          }

          sendStep(
            "retrieve",
            "检索相关文档片段",
            "done",
            `命中 ${matches.length} 条片段`,
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

          // Step 4：调用 LLM 生成回答
          sendStep("llm", "生成回答", "running");

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
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              currentContent += delta;
              answerForLog = currentContent;
              sendJSON({ type: "delta", data: delta });
            }
          }

          sendStep("llm", "生成回答", "done");
          await flushRunHistory();
          controller.close();
        } catch (err: any) {
          console.error("❌ Search error in stream:", err);
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
