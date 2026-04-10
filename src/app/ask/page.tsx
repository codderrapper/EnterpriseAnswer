"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import SourcesPanel from "@/components/SourcesPanel";
import { useChatStore } from "@/store/chatStore";
import type { Message } from "@/types/chat";

function ChatMessage({ msg }: { msg: Message }) {
  const isAI = msg.role === "assistant";

  return (
    <div
      className={`w-fit max-w-[88%] rounded-2xl px-4 py-3 ${
        isAI
          ? "border border-slate-200 bg-white text-slate-900 shadow-sm"
          : "ml-auto border border-blue-500 bg-blue-600 text-white shadow-sm"
      }`}
    >
      <MarkdownRenderer content={msg.content} tone={isAI ? "default" : "inverse"} />

      {isAI && msg.sources && msg.sources.length > 0 && (
        <div className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-600">
          <div className="mb-1 font-medium text-slate-800">来源</div>
          <div className="space-y-1">
            {msg.sources.map((source) => (
              <div key={source.id} className="truncate">
                <Link
                  href={`/documents/${source.document_id}?chunk=${source.id}`}
                  className="text-blue-600 hover:underline"
                  title={source.snippet}
                >
                  {source.snippet}
                </Link>
                <span className="text-slate-500">
                  {" "}
                  (相似度 {source.similarity ?? "-"})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AskPage() {
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const [hasHydratedHistory, setHasHydratedHistory] = useState(false);

  const {
    messages,
    isLoading,
    input,
    setInput,
    sendMessage,
    hydrateFromLocal,
    threshold,
  } = useChatStore();

  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const activeSources = lastAssistant?.sources ?? [];

  useEffect(() => {
    hydrateFromLocal();
    setHasHydratedHistory(true);
  }, [hydrateFromLocal]);

  useEffect(() => {
    if (typeof window !== "undefined" && hasHydratedHistory) {
      localStorage.setItem("chat_history_v2", JSON.stringify(messages));
    }
  }, [hasHydratedHistory, messages]);

  useLayoutEffect(() => {
    const el = chatBoxRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [messages]);

  async function handleSend() {
    await sendMessage();
  }

  return (
    <main className="h-[calc(100vh-4rem)] overflow-hidden bg-slate-100 text-slate-900">
      <div className="grid h-full w-full min-h-0 grid-rows-[minmax(0,1fr)_220px] overflow-hidden lg:flex lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50">
          <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Knowledge Workspace
                </p>
                <h1 className="text-2xl font-semibold text-slate-950">
                  Ask
                </h1>
                <p className="max-w-2xl text-sm text-slate-600">
                  Stable question answering over enterprise knowledge with cited
                  sources.
                </p>
              </div>
            </div>
          </header>

          <section
            ref={chatBoxRef}
            className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4"
          >
            {messages.map((message) => (
              <ChatMessage key={message.id} msg={message} />
            ))}
          </section>

          {isLoading && (
            <div className="shrink-0 px-5 pb-2 text-sm text-slate-500">
              AI 正在思考中…
            </div>
          )}

          <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
            <div className="flex gap-3">
              <label htmlFor="ask-question" className="sr-only">
                问题输入框
              </label>
              <textarea
                id="ask-question"
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
                className="min-h-11 max-h-48 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={isLoading}
                className={`h-11 rounded-xl px-4 text-sm font-medium text-white transition ${
                  isLoading
                    ? "cursor-not-allowed bg-slate-400"
                    : "bg-slate-900 hover:bg-slate-700"
                }`}
              >
                {isLoading ? "思考中..." : "发送"}
              </button>
            </div>
          </footer>
        </div>

        <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-slate-200 bg-slate-50 lg:w-[420px] lg:border-l lg:border-t-0">
          <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
            <div className="text-sm font-medium text-slate-900">Sources</div>
            <div className="text-xs text-slate-500">Latest retrieved context</div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <SourcesPanel sources={activeSources} threshold={threshold} />
          </div>
        </aside>
      </div>
    </main>
  );
}
