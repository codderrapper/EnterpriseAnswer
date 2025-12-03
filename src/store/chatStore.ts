// src/store/chatStore.ts
"use client";

import { create } from "zustand";
import type { Message, Source } from "@/types/chat";
import type { AgentStep, StepStatus } from "@/types/agent";

// 🧠 Chat 状态 & 行为
interface ChatState {
  messages: Message[];
  steps: AgentStep[];
  isLoading: boolean;

  // 输入框文本不一定要放 store，这里保留接口方便以后扩展
  input: string;
  setInput: (v: string) => void;

  // 发送消息（内部负责：追加消息、调用后端、流式解析、更新 steps）
  sendMessage: () => Promise<void>;

  // 从本地存储恢复历史（在页面 useEffect 里调用）
  hydrateFromLocal: () => void;
}

// 🚀 Chat Store：集中管理 Chat / Steps / Loading 状态
export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  steps: [],
  isLoading: false,
  input: "",

  setInput: (v: string) => set({ input: v }),

  hydrateFromLocal: () => {
    // 只在浏览器环境下有 localStorage
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

  sendMessage: async () => {
    const { input, isLoading, messages } = get();
    const userInput = input.trim();
    if (!userInput || isLoading) return;

    // ✨ 构造用户消息 + 空的 AI 消息（用于流式填充）
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

    // 历史对话：用于“上下文记忆”透传给后端
    const historyForBackend = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 先同步更新 UI：追加消息、清空步骤、进入 loading 状态
    set({
      messages: [...messages, userMessage, assistantMessage],
      steps: [],
      isLoading: true,
      input: "",
    });

    const assistantId = assistantMessage.id;

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userInput,
          history: historyForBackend,
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let done = false;
      let buffer = "";
      let currentContent = "";

      // 🔁 循环读取 server 返回的 chunk（JSONL 协议）
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

          // 🧩 按 type 分流：step / sources / delta / error
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
                // 新步骤：追加
                return { steps: [...prevSteps, step] };
              }
              // 已存在：覆盖更新
              const copy = [...prevSteps];
              copy[idx] = { ...copy[idx], ...step };
              return { steps: copy };
            });
          } else if (data.type === "sources") {
            const sources: Source[] =
              data.data?.map((m: any, idx: number) => ({
                id: m.id ?? idx,
                document_id: m.document_id ?? 0,
                snippet: m.content ?? m.snippet ?? "",
                similarity:
                  m.similarity?.toString() ?? m.score?.toString() ?? "",
              })) ?? [];

            set((prev) => ({
              messages: prev.messages.map((msg) =>
                msg.id === assistantId ? { ...msg, sources } : msg
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
                  : msg
              ),
            }));
          } else if (data.type === "error") {
            console.error("Server error:", data.data);
          }
        }
      }

      // buffer 残留（一般不会有）
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
                    : msg
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
      // 出错时追加一条错误消息
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
