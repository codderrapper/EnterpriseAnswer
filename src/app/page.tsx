// src/app/page.tsx
"use client";

import { useEffect, useRef, useLayoutEffect } from "react";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import UploadBox from "@/components/UploadBox";
import AgentStepsPanel from "@/components/AgentStepsPanel";
import type { Message } from "@/types/chat";
import { useChatStore } from "@/store/chatStore";

export default function Home() {
  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  const {
    messages,
    steps,
    isLoading,
    input,
    setInput,
    sendMessage,
    hydrateFromLocal,
    topK,
    threshold,
    setTopK,
    setThreshold,
  } = useChatStore();

  // 💾 从本地恢复历史
  useEffect(() => {
    hydrateFromLocal();
  }, [hydrateFromLocal]);

  // 💾 自动保存到本地（持久化对话）
  useEffect(() => {
    if (messages.length > 0 && typeof window !== "undefined") {
      localStorage.setItem("chat_history_v2", JSON.stringify(messages));
    }
  }, [messages]);

  // 🧭 每次消息变化后自动滚到底
  useLayoutEffect(() => {
    const el = chatBoxRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [messages]);

  // 🚀 发送提问（调用 store 的 sendMessage）
  async function handleSend() {
    await sendMessage();
  }

  // 🧱 渲染单条消息
  function ChatMessage({ msg }: { msg: Message }) {
    const isAI = msg.role === "assistant";
    return (
      <div
        className={`max-w-[85%] rounded-lg p-3 ${
          isAI
            ? "bg-white text-gray-900 self-start shadow-sm border"
            : "bg-blue-500 text-white self-end ml-auto"
        }`}
      >
        <MarkdownRenderer content={msg.content} />
        {/* 显示来源 */}
        {isAI && msg.sources && msg.sources.length > 0 && (
          <div className="mt-2 text-xs text-gray-600 border-t pt-1 space-y-1">
            <strong>来源：</strong>
            {msg.sources.map((s) => (
              <div key={s.id} className="truncate">
                📄{" "}
                <a
                  href={`/documents/${s.document_id}?chunk=${s.id}`}
                  className="text-blue-600 hover:underline"
                  title={s.snippet}
                >
                  {s.snippet}
                </a>
                <span className="text-gray-500">（相似度 {s.similarity}）</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="h-[100dvh] max-w-2xl mx-auto flex flex-col bg-gray-100 text-gray-900 border-x">
      {/* 顶部标题 */}
      <header className="p-4 border-b bg-white flex items-center justify-between">
        <div className="font-bold text-xl">企业文档智能助手</div>
        <a href="/documents" className="text-sm text-blue-600 hover:underline">
          文档管理 →
        </a>
        <a href="/runs" className="text-blue-600 hover:underline">
          运行历史 →
        </a>
      </header>

      {/* RAG 检索配置面板 */}
      <div className="px-4 pt-3">
        <div className="bg-white border rounded p-3 text-xs text-gray-700 flex flex-wrap gap-3 items-center justify-between">
          <div className="font-medium text-gray-800">
            🔧 检索配置（影响 RAG 召回）
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="flex items-center gap-1">
              <span>TopK：</span>
              <input
                type="number"
                min={1}
                max={20}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="w-16 border rounded px-1 py-0.5 text-xs"
              />
            </label>
            <label className="flex items-center gap-1">
              <span>阈值：</span>
              <input
                type="number"
                step={0.05}
                min={0}
                max={1}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-16 border rounded px-1 py-0.5 text-xs"
              />
            </label>
            <span className="text-[11px] text-gray-500">
              TopK 越大召回越多，阈值越高越严格。
            </span>
          </div>
        </div>
      </div>

      {/* 上传组件 */}
      <div className="p-4">
        <UploadBox />
      </div>

      {/* Agent 执行步骤面板（已封装组件，可折叠） */}
      <AgentStepsPanel steps={steps} />

      {/* 聊天内容区 */}
      <section
        ref={chatBoxRef}
        className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3 scroll-smooth"
      >
        {messages.map((m) => (
          <ChatMessage key={m.id} msg={m} />
        ))}
      </section>

      {isLoading && (
        <div className="self-start text-gray-500 text-sm animate-pulse px-3">
          🤖 AI 正在思考中…
        </div>
      )}

      {/* 底部输入区 */}
      <footer className="p-4 border-t bg-white flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isLoading) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="请输入问题..."
          disabled={isLoading}
          className="flex-1 border rounded p-2 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400"
          style={{ minHeight: "40px", maxHeight: "200px" }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading}
          className={`px-4 py-2 rounded text-white ${
            isLoading ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {isLoading ? "思考中..." : "发送"}
        </button>
      </footer>
    </main>
  );
}
