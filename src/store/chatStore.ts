// @deprecated: Migrating to useChatRuntimeStore from @/features/chat/store/chatRuntimeStore. Do not add new code here.
/**
 * ⭐ 面试亮点（useChatStore）：
 * 1. 使用 Zustand 管理 Chat 的业务状态（messages / steps / loading / input），并集中封装 sendMessage 流程，组件只负责展示。
 * 2. 将 RAG 检索配置（topK / threshold）放入 store，由前端 UI 控制，并在调用 /api/search 时透传到后端，
 *    体现“AI 应用不是写死参数，而是具备可配置能力”，更像平台而非 Demo。
 * 3. 在 sendMessage 中统一处理 JSONL 流解析（step / sources / delta / error），将网络协议与 UI 渲染解耦，符合前端工程化设计。
 */

"use client";

import { create } from "zustand";
import type { Message, Source } from "@/types/chat";
import type { AgentStep, StepStatus } from "@/types/agent";

interface ChatState {
  messages: Message[];
  steps: AgentStep[];
  isLoading: boolean;

  // 🧠 RAG 检索配置：由前端可视化面板控制
  topK: number; // 向量检索返回多少条文档片段
  threshold: number; // 相似度阈值

  setTopK: (k: number) => void;
  setThreshold: (t: number) => void;

  sendMessage: (input: string) => Promise<void>;

  hydrateFromLocal: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  steps: [],
  isLoading: false,

  // 默认配置：topK=5, 阈值=0.4，与你之前后端逻辑对齐
  topK: 5,
  threshold: 0.4,

  setTopK: (k) =>
    set({
      topK: Number.isFinite(k) && k > 0 ? Math.min(Math.floor(k), 20) : 5,
    }),

  setThreshold: (t) =>
    set({
      threshold: Number.isFinite(t) && t >= 0 && t <= 1 ? t : 0.4,
    }),

  hydrateFromLocal: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("chat_history_v2");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Message[];
      set({ messages: parsed });
    } catch (e) {
      console.warn("恢复本地聊天记录失败:", e);
    }
  },

  sendMessage: async (input: string) => {
    const { isLoading, messages, topK, threshold } = get();
    const userInput = input.trim();
    if (!userInput || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userInput,
    };
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      sources: [],
    };

    const historyForBackend = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    set({
      messages: [...messages, userMessage, assistantMessage],
      steps: [],
      isLoading: true,
    });

    const assistantId = assistantMessage.id;

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userInput,
          history: historyForBackend,
          topK,
          threshold,
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let done = false;
      let buffer = "";
      let currentContent = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (!value) continue;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let data: any;
          try {
            data = JSON.parse(line);
          } catch (e) {
            console.error("JSON parse error:", line);
            continue;
          }

          if (data.type === "step") {
            const step = data.data as {
              id: string;
              title: string;
              status: StepStatus;
              detail?: string;
            };

            set((prev) => {
              const prevSteps = prev.steps;
              const idx = prevSteps.findIndex((s) => s.id === step.id);
              if (idx === -1) {
                return { steps: [...prevSteps, step] };
              }
              const copy = [...prevSteps];
              copy[idx] = { ...copy[idx], ...step };
              return { steps: copy };
            });
          } else if (data.type === "sources") {
            const sources: Source[] = data.data
              ? data.data.map((m: any, idx: number) => {
                  const simRaw =
                    typeof m.similarity === "number"
                      ? m.similarity
                      : typeof m.score === "number"
                        ? m.score
                        : Number(m.similarity ?? m.score);
                  return {
                    id: m.id ?? idx,
                    document_id: m.document_id ?? 0,
                    snippet: m.content ?? m.snippet ?? "",
                    similarity: Number.isFinite(simRaw) ? simRaw : null,
                  };
                })
              : [];

            set((prev) => ({
              messages: prev.messages.map((msg) =>
                msg.id === assistantId ? { ...msg, sources } : msg,
              ),
            }));
          } else if (data.type === "delta") {
            const deltaText: string = data.data ?? "";
            if (!deltaText) continue;

            currentContent += deltaText;

            set((prev) => ({
              messages: prev.messages.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: currentContent }
                  : msg,
              ),
            }));
          } else if (data.type === "error") {
            console.error("Server error:", data.data);
          }
        }
      }

      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.type === "delta") {
            const deltaText: string = data.data ?? "";
            if (deltaText) {
              const finalContent = currentContent + deltaText;
              set((prev) => ({
                messages: prev.messages.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: finalContent }
                    : msg,
                ),
              }));
            }
          }
        } catch (e) {
          console.warn("最终 buffer 解析失败，可忽略:", buffer);
        }
      }
    } catch (err) {
      console.error(err);
      set((prev) => ({
        messages: [
          ...prev.messages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "❌ 出错啦，请稍后重试。",
          },
        ],
      }));
    } finally {
      set({ isLoading: false });
    }
  },
}));
