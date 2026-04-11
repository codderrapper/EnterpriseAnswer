"use client";

import { useEffect, useLayoutEffect, useRef, useState, memo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  AUTO_FOLLOW_THRESHOLD_PX,
  isNearBottom,
} from "@/app/ask/scroll";
import { useChatStore } from "@/store/chatStore";
import type { Message } from "@/types/chat";

// ⚡ 优化：异步加载重型 Markdown 渲染器，提升页面切换速度
const MarkdownRenderer = dynamic(() => import("@/components/MarkdownRenderer"), {
  ssr: false,
  loading: () => <div className="h-6 w-32 animate-pulse rounded bg-slate-100" />,
});

/**
 * ⚡ 优化1：使用 React.memo 避免消息列表在输入时重复渲染。
 * 因为输入框状态在父组件，如果不 memo，每打一个字都会触发所有历史消息的重绘。
 */
const ChatMessage = memo(function ChatMessage({ msg }: { msg: Message }) {
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
});

/**
 * ⚡ 优化2：将输入框拆分为独立组件，实现状态下沉。
 * 这样用户打字时，只有这个小组件在重新渲染，不会影响到上面的消息展示区域。
 */
function ChatInput({
  onSend,
  isLoading,
}: {
  onSend: (val: string) => Promise<void>;
  isLoading: boolean;
}) {
  const [input, setInput] = useState("");

  const handleSend = async () => {
    const val = input.trim();
    if (!val || isLoading) return;
    await onSend(val);
    setInput("");
  };

  return (
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
  );
}

export default function AskPage() {
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(0);
  const [hasHydratedHistory, setHasHydratedHistory] = useState(false);
  const [isAutoFollowEnabled, setIsAutoFollowEnabled] = useState(true);

  const {
    messages,
    isLoading,
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
    if (!el || !isAutoFollowEnabled) return;

    const hasNewMessageBatch = messages.length > previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    requestAnimationFrame(() => {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: hasNewMessageBatch && !isLoading ? "smooth" : "auto",
      });
    });
  }, [isAutoFollowEnabled, isLoading, messages]);

  function handleChatScroll() {
    const el = chatBoxRef.current;
    if (!el) return;

    setIsAutoFollowEnabled(
      isNearBottom(
        el.scrollTop,
        el.clientHeight,
        el.scrollHeight,
        AUTO_FOLLOW_THRESHOLD_PX,
      ),
    );
  }

  function scrollToBottomAndResume() {
    const el = chatBoxRef.current;
    if (!el) return;

    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setIsAutoFollowEnabled(true);
  }

  return (
    <main className="h-[calc(100vh-4rem)] overflow-hidden bg-slate-100 text-slate-900">
      <div className="grid h-full w-full min-h-0 grid-rows-[minmax(0,1fr)_220px] overflow-hidden lg:flex lg:flex-row">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50">
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
            onScroll={handleChatScroll}
            className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4"
          >
            {messages.map((message) => (
              <ChatMessage key={message.id} msg={message} />
            ))}
          </section>

          {!isAutoFollowEnabled && (
            <div className="pointer-events-none absolute inset-x-0 bottom-22 flex justify-center px-5">
              <button
                type="button"
                onClick={scrollToBottomAndResume}
                className="pointer-events-auto rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-md hover:bg-slate-50"
              >
                回到底部
              </button>
            </div>
          )}

          {isLoading && (
            <div className="shrink-0 px-5 pb-2 text-sm text-slate-500">
              AI 正在思考中…
            </div>
          )}

          <ChatInput onSend={sendMessage} isLoading={isLoading} />
        </div>

        {/* ⚡ 优化：移除右侧常驻的 SourcesPanel，腾出空间给未来的文档详情预览 */}
        <aside className="hidden min-h-0 w-full shrink-0 flex-col border-t border-slate-200 bg-slate-50 lg:flex lg:w-[320px] lg:border-l lg:border-t-0">
          <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
            <div className="text-sm font-medium text-slate-900">详情</div>
            <div className="text-xs text-slate-500">点击来源查看文档原文</div>
          </div>
          <div className="flex-1 items-center justify-center flex p-4 text-slate-400 text-sm italic">
            暂无详情
          </div>
        </aside>
      </div>
    </main>
  );
}
