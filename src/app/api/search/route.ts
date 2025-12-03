// src/app/api/search/route.ts

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { embeddings } from "@/lib/embedClient";
import { aiClient, AI_MODEL } from "@/lib/ai-client";

// 💡 runtime 指定为 nodejs（而不是 edge）
// 因为：
// 1）我们用到了 Supabase 客户端、LangChain 等 Node 生态库
// 2）Node runtime 对长连接 / 大计算更稳定
export const runtime = "nodejs";

// ========= 类型定义区域（面试官爱看你有没有显式类型） =========

type HistoryItem = {
  role: "user" | "assistant";
  content: string;
};

// 🧠 Agent Step 的状态，前端用来渲染执行过程
type StepStatus = "pending" | "running" | "done" | "error";

// 向量检索返回的每一行记录结构（视你的 Supabase RPC 返回而定）
type MatchRow = {
  id: number;
  document_id: number;
  content: string;
  similarity?: number;
  score?: number;
};

// ========= 核心 Handler =========

export async function POST(req: Request) {
  try {
    // 1️⃣ 解析请求体：问题 + 多轮对话历史
    // 为什么 history 从前端传？
    // 👉 保持后端 stateless（无状态），容易横向扩容，也易于测试/复用。
    const { question, history } = (await req.json()) as {
      question?: string;
      history?: HistoryItem[];
    };

    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    const encoder = new TextEncoder();

    // 🔁 使用 ReadableStream 实现服务端手动流式输出
    // 这是面试里“流式响应 / SSE / streaming”常见考点
    const stream = new ReadableStream({
      async start(controller) {
        // 小工具：统一 JSONL 输出
        const sendJSON = (obj: any) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        };

        // Agent 步骤事件：前端用来可视化执行链路（非常符合“智能体平台”的产品形态）
        const sendStep = (
          id: string,
          title: string,
          status: StepStatus,
          detail?: string
        ) => {
          sendJSON({ type: "step", data: { id, title, status, detail } });
        };

        try {
          // 🟢 Step 1：收到问题（只是一个语义上的 step，方便前端展示）
          sendStep("received", "收到问题", "done", question);

          // 🟡 Step 2：对用户问题做 embedding（RAG 的 Query 向量）
          // 👉 面试重点：RAG pipeline = {embed query → 向量检索 → 组装上下文 → 交给 LLM}
          sendStep("embed", "生成查询向量", "running");

          const [queryVector] = await embeddings.embedDocuments([question]);

          sendStep("embed", "生成查询向量", "done");

          // 🟡 Step 3：向量检索（调用 Supabase RPC）
          sendStep("retrieve", "检索相关文档片段", "running");

          const { data: rawMatches, error } = await supabase.rpc(
            "match_documents",
            {
              query_embedding: queryVector,
              match_threshold: 0.4,
              match_count: 5,
            }
          );

          if (error) {
            // 向量检索失败 → 直接作为 Agent error step
            sendStep(
              "retrieve",
              "检索相关文档片段",
              "error",
              error.message
            );
            throw error;
          }

          const matches = (rawMatches ?? []) as MatchRow[];

          if (!matches.length) {
            sendStep(
              "retrieve",
              "检索相关文档片段",
              "done",
              "未找到相关内容"
            );

            // 没有命中：这里直接返回一小段 delta 文本
            // 👉 依然走流式协议，保持前后端协议统一
            sendJSON({
              type: "delta",
              data: "文档中未找到相关信息。",
            });

            controller.close();
            return;
          }

          sendStep(
            "retrieve",
            "检索相关文档片段",
            "done",
            `命中 ${matches.length} 条片段`
          );

          const context = matches.map((m) => m.content).join("\n---\n");

          // 🧾 向前端发送引用来源（source 卡片）
          // 这一行非常关键：RAG 的“可解释性”和“可追溯性”
          sendJSON({ type: "sources", data: matches });

          // ================== ⭐ 模拟 Tool 调用（智能体核心概念） ==================
          // 这里我们模拟一个“searchDocs”工具：
          // 在真实 Agent 系统里，LLM 会产生一个 tool_call，
          // 然后由后端调用对应的工具（HTTP / DB / 内部服务），
          // 再把结果作为下一步上下文。
          //
          // 我们这里简化为：用 matches 当作工具返回结果，
          // 但从“step 事件 + 输入/输出”的角度，和真实 Tool 非常接近。
          sendStep("tool", "调用工具：searchDocs", "running");

          try {
            // 🛠️ 这里可以是任何异步工具调用：HTTP 请求 / 数据库查询 / 外部服务
            // 为了让行为明显一点，我们模拟一个 300ms 的耗时
            await new Promise((resolve) => setTimeout(resolve, 300));

            // 工具逻辑：例如我们可以在这里做 re-rank / 摘要 / 过滤
            // 这里用最简单的形式：取前 N 条，说明一下数量
            const toolSummary = `工具 searchDocs 返回了 ${matches.length} 条候选片段`;

            sendStep("tool", "调用工具：searchDocs", "done", toolSummary);
          } catch (toolErr: any) {
            sendStep(
              "tool",
              "调用工具：searchDocs",
              "error",
              toolErr?.message || "工具调用失败"
            );
            // 工具失败时不一定要中断整个回答，这里可以策略化处理
            // 简化起见，我们继续往下，让模型在没有工具结果的前提下回答
          }

          // ================== ⭐ 调用 LLM 生成最终答案（Agent 最终决策） ==================

          const systemPrompt = `
你是一名企业知识问答助手，请根据提供的企业内部文档内容，用简洁、正式的中文回答问题。
如果文档中找不到答案，请直接回复：“文档中未提及相关信息。”，不要编造。
`;

          // 📌 多轮对话历史：从前端传来的 history 拼进 messages
          // 面试看点：你是否理解“多轮对话 = 前端维护历史 + 后端透传给 LLM”
          const historyMessages =
            history?.map((m) => ({
              role: m.role === "user" ? ("user" as const) : ("assistant" as const),
              content: m.content,
            })) ?? [];

          // 当前轮问题，显式带上 RAG 上下文
          const currentUserMessage = {
            role: "user" as const,
            content: `请基于以下【文档内容】回答用户当前的问题。\n\n【文档内容】\n${context}\n\n【当前问题】\n${question}`,
          };

          // 🟡 Step 4：调用大模型，做最终回答
          sendStep("llm", "生成回答", "running");

          // 这里使用的是 OpenAI 兼容协议，stream: true → 服务端流式
          const completion = await aiClient.chat.completions.create({
            model: AI_MODEL,
            stream: true,
            messages: [
              { role: "system", content: systemPrompt },
              ...historyMessages,
              currentUserMessage,
            ],
          });

          // 逐块读取流式结果，转成 JSONL（type: "delta"）
          // 👉 面试重点：理解“服务端 push 流 + 前端增量渲染”的模式
          for await (const chunk of completion) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              sendJSON({ type: "delta", data: delta });
            }
          }

          // ✅ LLM 执行完成
          sendStep("llm", "生成回答", "done");

          controller.close();
        } catch (err: any) {
          // 这里是流内部的错误处理，尽量把错误也以事件形式发送给前端
          console.error("❌ Search error in stream:", err);

          sendStep(
            "error",
            "服务端出错",
            "error",
            err?.message || "Unknown error"
          );

          sendJSON({
            type: "error",
            data: err?.message || "Server error",
          });

          controller.close();
        }
      },
    });

    // 注意：这里返回的是原生 Response，而不是 NextResponse.json
    // 因为我们发送的是“文本流（text/plain + JSONL）”，而不是一次性 JSON。
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (err: any) {
    // 这里是“外层同步错误”（比如 req.json() 失败）
    console.error("❌ Search error (outer):", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
