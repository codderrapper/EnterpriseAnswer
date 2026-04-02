// src/app/page.tsx
"use client";

import { useEffect, useRef, useLayoutEffect, useState } from "react";
import Link from "next/link";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import AgentStepsPanel from "@/components/AgentStepsPanel";
import type { Message } from "@/types/chat";
import { useChatStore } from "@/store/chatStore";
import SourcesPanel from "@/components/SourcesPanel";

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

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const activeSources = lastAssistant?.sources ?? [];
  // ✅ UI 折叠开关：默认都收起，让聊天更聚焦
  const [showConfig, setShowConfig] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

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
                <Link
                  href={`/documents/${s.document_id}?chunk=${s.id}`}
                  className="text-blue-600 hover:underline"
                  title={s.snippet}
                >
                  {s.snippet}
                </Link>
                <span className="text-gray-500">（相似度 {s.similarity}）</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="h-[100dvh] w-full bg-gray-100 text-gray-900">
      <div className="h-full w-full max-w-[1400px] mx-auto flex">
        {/* 左侧：聊天主区域 */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
          {/* header */}
          <header className="shrink-0 p-4 border-b bg-white flex items-center justify-between">
            <div className="font-bold text-xl">企业文档智能助手</div>

            <div className="flex items-center gap-3">
              {/* ✅ 放这里：高级参数开关 */}
              <button
                type="button"
                onClick={() => setShowConfig((v) => !v)}
                className="text-sm px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                title="展开/收起检索参数"
              >
                ⚙ 检索参数 {showConfig ? "▲" : "▼"}
              </button>

              {/* ✅ 执行过程开关（默认不占空间） */}
              <button
                type="button"
                onClick={() => setShowSteps((v) => !v)}
                className="text-sm px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                title="展开/收起执行过程"
              >
                🧭 执行过程 {showSteps ? "▲" : "▼"}
              </button>

              <Link href="/documents" className="text-sm text-blue-600 hover:underline">
                文档管理 →
              </Link>
              <Link href="/runs" className="text-sm text-blue-600 hover:underline">
                运行历史 →
              </Link>
              <Link href="/experiments" className="text-sm text-blue-600 hover:underline">
                实验面板 →
              </Link>
              <Link href="/prompts" className="text-sm text-blue-600 hover:underline">
                Prompt 管理 →
              </Link>
            </div>
          </header>
          {/* RAG 检索配置面板 */}
          {showConfig && (
            <div className="shrink-0 px-4 pt-3">
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
          )}
          {/* 上传组件 */}
          {/* <div className="shrink-0 p-4">
            <UploadBox />
          </div> */}
          {/* Agent 执行步骤面板（已封装组件，可折叠） */}
          {/* <div className="shrink-0 px-4"> */}
          {showSteps && (
            <div className="shrink-0 px-4 pt-2">
              <AgentStepsPanel steps={steps} />
            </div>
          )}
          {/* </div> */}
          {/* 聊天内容区 */}
          <section
            ref={chatBoxRef}
            className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 scroll-smooth"
          >
            {messages.map((m) => (
              <ChatMessage key={m.id} msg={m} />
            ))}
          </section>
          {isLoading && (
            <div className="shrink-0 text-gray-500 text-sm animate-pulse px-4 pb-2">
              🤖 AI 正在思考中…
            </div>
          )}
          {/* 底部输入区 */}
          <footer className="shrink-0 p-4 border-t bg-white flex gap-2">
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
        </div>
        <aside className="w-[420px] shrink-0 border-l bg-gray-100 hidden lg:flex flex-col">
          <div className="p-4 border-b bg-white shrink-0">
            <div className="font-medium text-sm">检索解释</div>
            <div className="text-xs text-gray-500">本次 RAG TopK 来源</div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <SourcesPanel sources={activeSources} threshold={threshold} />
          </div>
        </aside>
      </div>
    </main>
  );
}
