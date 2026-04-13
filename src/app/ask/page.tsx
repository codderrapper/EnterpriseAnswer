"use client";

import { useLayoutEffect, useRef, useState, memo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  AUTO_FOLLOW_THRESHOLD_PX,
  isNearBottom,
} from "@/app/ask/scroll";
import { useWorkflowRuntimeStore } from "@/features/knowledge-workflow/store/workflowRuntimeStore";
import { useChat } from "@/features/chat/hooks/useChat";
import TracePanel from "@/features/chat/components/TracePanel";
import EvidencePanel from "@/features/chat/components/EvidencePanel";

// Async-load the heavy Markdown renderer to speed up page transitions
const MarkdownRenderer = dynamic(() => import("@/components/MarkdownRenderer"), {
  ssr: false,
  loading: () => <div className="h-6 w-32 animate-pulse rounded bg-slate-100" />,
});

/**
 * Memoised to avoid re-rendering all messages when the input field changes.
 */
const ChatMessage = memo(function ChatMessage({
  msg,
}: {
  msg: { id: string; role: string; content: string };
}) {
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
    </div>
  );
});

/**
 * Input box is a separate component so typing only re-renders this subtree,
 * not the entire message list.
 */
function ChatInput({
  onSend,
  isLoading,
}: {
  onSend: (val: string) => void;
  isLoading: boolean;
}) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    const val = input.trim();
    if (!val || isLoading) return;
    onSend(val);
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
  const [isAutoFollowEnabled, setIsAutoFollowEnabled] = useState(true);

  const workflowStore = useWorkflowRuntimeStore();

  const { messages, append, isLoading } = useChat({
    api: "/api/chat",
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  const sendMessage = useCallback(
    async (question: string) => {
      workflowStore.reset();
      await append({ role: "user", content: question });
    },
    [append, workflowStore],
  );

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
      isNearBottom(el.scrollTop, el.clientHeight, el.scrollHeight, AUTO_FOLLOW_THRESHOLD_PX),
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
                <h1 className="text-2xl font-semibold text-slate-950">Ask</h1>
                <p className="max-w-2xl text-sm text-slate-600">
                  Stable question answering over enterprise knowledge with cited sources.
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

        <aside className="hidden min-h-0 w-full shrink-0 flex-col border-t border-slate-200 bg-slate-50 lg:flex lg:w-[320px] lg:border-l lg:border-t-0">
          <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
            <div className="text-sm font-medium text-slate-900">详情</div>
            <div className="text-xs text-slate-500">路由与证据</div>
          </div>
          <div className="shrink-0 px-3 pt-3">
            <TracePanel />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <EvidencePanel />
          </div>
        </aside>
      </div>
    </main>
  );
}
